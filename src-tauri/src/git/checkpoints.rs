//! Checkpoints: snapshots of the working tree before every prompt, stored as
//! commits on hidden refs (ADR 0023).
//!
//! A snapshot uses a temporary copy of the index, so `HEAD`, the real index
//! and the working tree are never touched. Restoring brings the project's
//! files back to a checkpoint and first takes a checkpoint of the current
//! state, so a restore can be undone the same way.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use specta::Type;

use super::cli::{git, git_with_env, repo_prefix};
use crate::error::{Error, Result};

/// Checkpoints kept per project; older ones are deleted.
const MAX_CHECKPOINTS: usize = 50;
/// More untracked, not ignored files than this and no snapshot is taken: a
/// missing `.gitignore` (e.g. for `node_modules`) would copy them all into
/// the repository.
const MAX_UNTRACKED: usize = 2000;
const REF_ROOT: &str = "refs/ame/checkpoints";
/// Author of checkpoint commits; they never become part of the history.
const IDENTITY: [(&str, &str); 4] = [
    ("GIT_AUTHOR_NAME", "Ame"),
    ("GIT_AUTHOR_EMAIL", "ame@localhost"),
    ("GIT_COMMITTER_NAME", "Ame"),
    ("GIT_COMMITTER_EMAIL", "ame@localhost"),
];
/// Paths per `git restore` call, against command-line length limits.
const RESTORE_CHUNK: usize = 200;

/// Checkpoints of one repository are taken and restored one at a time.
static LOCK: Mutex<()> = Mutex::new(());
static NEXT_INDEX: AtomicU32 = AtomicU32::new(0);

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Checkpoint {
    /// Stable id within the project.
    pub id: String,
    /// Milliseconds since the Unix epoch.
    pub created_at: f64,
    pub label: String,
}

/// How a file differs now from a checkpoint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum CheckpointChange {
    /// New since the checkpoint; restoring deletes it.
    Added,
    /// Changed since the checkpoint.
    Modified,
    /// Deleted since the checkpoint; restoring brings it back.
    Deleted,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointFile {
    /// Project-relative, with `/` separators.
    pub path: String,
    pub change: CheckpointChange,
}

/// The repository a project folder lives in.
struct Repo {
    toplevel: PathBuf,
    /// The project folder inside the repository (`""` or ending in `/`).
    prefix: String,
    /// Ref folder of this project's checkpoints.
    refs: String,
}

impl Repo {
    fn open(root: &Path) -> Result<Option<Self>> {
        let Some(prefix) = repo_prefix(root)? else {
            return Ok(None);
        };
        let toplevel = PathBuf::from(text(git(root, &["rev-parse", "--show-toplevel"])?));
        let refs = format!("{REF_ROOT}/{:016x}", fnv1a(prefix.as_bytes()));
        Ok(Some(Self {
            toplevel,
            prefix,
            refs,
        }))
    }

    fn git(&self, args: &[&str]) -> Result<Vec<u8>> {
        git(&self.toplevel, args)
    }

    /// A tree of the whole working tree as it is now (respecting
    /// `.gitignore`), or `None` if there are too many untracked files.
    fn snapshot(&self) -> Result<Option<String>> {
        let untracked = self.git(&["ls-files", "--others", "--exclude-standard", "-z"])?;
        if untracked
            .split(|&b| b == 0)
            .filter(|p| !p.is_empty())
            .count()
            > MAX_UNTRACKED
        {
            log::warn!(
                "no checkpoint for {}: more than {MAX_UNTRACKED} untracked files",
                self.toplevel.display()
            );
            return Ok(None);
        }
        let index = TempIndex::new(self)?;
        let path = index.0.to_string_lossy().into_owned();
        let vars = [("GIT_INDEX_FILE", path.as_str())];
        git_with_env(&self.toplevel, &["add", "-A", "--", "."], &vars)?;
        let tree = text(git_with_env(&self.toplevel, &["write-tree"], &vars)?);
        Ok(Some(tree))
    }

    /// All checkpoints, newest first, as (ref, commit, subject).
    fn refs(&self) -> Result<Vec<(String, String, String)>> {
        let output = self.git(&[
            "for-each-ref",
            "--sort=-refname",
            "--format=%(refname)%00%(objectname)%00%(subject)",
            &self.refs,
        ])?;
        Ok(String::from_utf8_lossy(&output)
            .lines()
            .filter_map(|line| {
                let mut parts = line.split('\0');
                Some((
                    parts.next()?.to_owned(),
                    parts.next()?.to_owned(),
                    parts.next().unwrap_or_default().to_owned(),
                ))
            })
            .collect())
    }

    fn commit_of(&self, id: &str) -> Result<String> {
        if id.is_empty() || !id.bytes().all(|b| b.is_ascii_digit()) {
            return Err(Error::Git(format!("unknown checkpoint {id}")));
        }
        let name = format!("{}/{id}", self.refs);
        self.git(&["rev-parse", "--verify", "--quiet", &name])
            .map(text)
            .map_err(|_| Error::Git(format!("unknown checkpoint {id}")))
    }

    fn create(&self, label: &str) -> Result<Option<Checkpoint>> {
        let Some(tree) = self.snapshot()? else {
            return Ok(None);
        };
        let refs = self.refs()?;
        if let Some((_, commit, _)) = refs.first() {
            let latest = text(self.git(&["rev-parse", &format!("{commit}^{{tree}}")])?);
            if latest == tree {
                return Ok(None);
            }
        }
        let head = self
            .git(&["rev-parse", "--verify", "--quiet", "HEAD"])
            .map(text);
        let mut args = vec!["commit-tree", tree.as_str(), "-m", label];
        if let Ok(head) = &head {
            args.extend(["-p", head.as_str()]);
        }
        let commit = text(git_with_env(&self.toplevel, &args, &IDENTITY)?);
        // Ids sort like the time they were taken (zero-padded milliseconds).
        let newest = refs
            .first()
            .and_then(|(name, _, _)| name.rsplit('/').next()?.parse::<u64>().ok());
        let millis = now_ms().max(newest.map_or(0, |n| n + 1));
        let id = format!("{millis:015}");
        self.git(&["update-ref", &format!("{}/{id}", self.refs), &commit])?;
        for (name, _, _) in refs.iter().skip(MAX_CHECKPOINTS - 1) {
            self.git(&["update-ref", "-d", name])?;
        }
        Ok(Some(Checkpoint {
            id,
            created_at: millis as f64,
            label: label.to_owned(),
        }))
    }

    /// Files of the project that differ now from the checkpoint commit.
    fn changes(&self, commit: &str) -> Result<Vec<CheckpointFile>> {
        let Some(now) = self.snapshot()? else {
            return Err(Error::Git("too many untracked files".into()));
        };
        let mut args = vec![
            "diff-tree",
            "-r",
            "--no-renames",
            "--name-status",
            "-z",
            commit,
            &now,
        ];
        let spec;
        if !self.prefix.is_empty() {
            spec = format!(":(top){}", self.prefix);
            args.extend(["--", spec.as_str()]);
        }
        let output = self.git(&args)?;
        Ok(parse_name_status(&output, &self.prefix))
    }

    fn restore(&self, id: &str) -> Result<Option<Checkpoint>> {
        let commit = self.commit_of(id)?;
        let files = self.changes(&commit)?;
        if files.is_empty() {
            return Ok(None);
        }
        let undo = self.create("Before restoring a checkpoint")?;
        let mut restore = Vec::new();
        for file in &files {
            let path = format!("{}{}", self.prefix, file.path);
            match file.change {
                CheckpointChange::Added => {
                    let full = self.toplevel.join(&path);
                    if let Err(err) = std::fs::remove_file(&full) {
                        log::warn!("could not remove {}: {err}", full.display());
                    }
                }
                CheckpointChange::Modified | CheckpointChange::Deleted => restore.push(path),
            }
        }
        let source = format!("--source={commit}");
        for chunk in restore.chunks(RESTORE_CHUNK) {
            let mut args = vec!["restore", source.as_str(), "--worktree", "--"];
            args.extend(chunk.iter().map(String::as_str));
            self.git(&args)?;
        }
        Ok(undo)
    }
}

/// A copy of the real index under `.git`, removed when dropped.
struct TempIndex(PathBuf);

impl TempIndex {
    fn new(repo: &Repo) -> Result<Self> {
        let name = format!(
            "ame-checkpoint-{}-{}.index",
            std::process::id(),
            NEXT_INDEX.fetch_add(1, Ordering::Relaxed)
        );
        let path = repo
            .toplevel
            .join(text(repo.git(&["rev-parse", "--git-path", &name])?));
        let real = repo
            .toplevel
            .join(text(repo.git(&["rev-parse", "--git-path", "index"])?));
        // Copying keeps the file stats, so unchanged files are not re-read.
        if real.exists() {
            std::fs::copy(&real, &path)?;
        }
        Ok(Self(path))
    }
}

impl Drop for TempIndex {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Takes a checkpoint of the project unless nothing changed since the last
/// one. `None` also outside a git repository.
pub fn create(root: &Path, label: &str) -> Result<Option<Checkpoint>> {
    let _guard = LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    match Repo::open(root)? {
        Some(repo) => repo.create(label),
        None => Ok(None),
    }
}

/// The project's checkpoints, newest first.
pub fn list(root: &Path) -> Result<Vec<Checkpoint>> {
    let Some(repo) = Repo::open(root)? else {
        return Ok(Vec::new());
    };
    Ok(repo
        .refs()?
        .into_iter()
        .filter_map(|(name, _, label)| {
            let id = name.rsplit('/').next()?.to_owned();
            let created_at = id.parse::<u64>().ok()? as f64;
            Some(Checkpoint {
                id,
                created_at,
                label,
            })
        })
        .collect())
}

/// How the project's files differ now from a checkpoint.
pub fn changes(root: &Path, id: &str) -> Result<Vec<CheckpointFile>> {
    let _guard = LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let repo = Repo::open(root)?.ok_or_else(|| Error::Git("not a git repository".into()))?;
    let commit = repo.commit_of(id)?;
    repo.changes(&commit)
}

/// Brings the project's files back to a checkpoint. Returns the checkpoint
/// of the state before, to undo the restore (`None` if nothing changed).
pub fn restore(root: &Path, id: &str) -> Result<Option<Checkpoint>> {
    let _guard = LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let repo = Repo::open(root)?.ok_or_else(|| Error::Git("not a git repository".into()))?;
    repo.restore(id)
}

/// Parses `git diff-tree --name-status -z` from the checkpoint to now.
fn parse_name_status(output: &[u8], prefix: &str) -> Vec<CheckpointFile> {
    let mut fields = output.split(|&b| b == 0).filter(|f| !f.is_empty());
    let mut files = Vec::new();
    while let (Some(status), Some(path)) = (fields.next(), fields.next()) {
        let change = match status.first() {
            Some(b'A') => CheckpointChange::Added,
            Some(b'D') => CheckpointChange::Deleted,
            _ => CheckpointChange::Modified,
        };
        let path = String::from_utf8_lossy(path);
        let Some(path) = path.strip_prefix(prefix) else {
            continue;
        };
        files.push(CheckpointFile {
            path: path.to_owned(),
            change,
        });
    }
    files
}

fn text(bytes: Vec<u8>) -> String {
    String::from_utf8_lossy(&bytes).trim().to_owned()
}

fn fnv1a(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325, |hash, &byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3)
    })
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn run(dir: &Path, args: &[&str]) -> String {
        text(git(dir, args).unwrap_or_else(|err| panic!("git {args:?}: {err}")))
    }

    /// A repository with one commit, a staged change and a project subfolder.
    fn repo() -> tempfile::TempDir {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path();
        run(root, &["init", "-q", "-b", "main"]);
        run(root, &["config", "user.email", "test@example.com"]);
        run(root, &["config", "user.name", "Test"]);
        fs::create_dir(root.join("web")).unwrap();
        fs::write(root.join("web/app.ts"), "one\n").unwrap();
        fs::write(root.join("web/keep.ts"), "keep\n").unwrap();
        fs::write(root.join(".gitignore"), "ignored.log\n").unwrap();
        run(root, &["add", "."]);
        run(root, &["commit", "-q", "-m", "init"]);
        dir
    }

    #[test]
    fn takes_checkpoints_without_touching_head_index_or_files() {
        let dir = repo();
        let web = dir.path().join("web");
        fs::write(web.join("app.ts"), "two\n").unwrap();
        run(dir.path(), &["add", "web/app.ts"]);
        fs::write(web.join("new.ts"), "new\n").unwrap();
        let head = run(dir.path(), &["rev-parse", "HEAD"]);
        let status = run(dir.path(), &["status", "--porcelain"]);

        let first = create(&web, "Before prompt 1").unwrap().unwrap();
        assert_eq!(first.label, "Before prompt 1");
        assert_eq!(run(dir.path(), &["rev-parse", "HEAD"]), head);
        assert_eq!(run(dir.path(), &["status", "--porcelain"]), status);
        assert_eq!(fs::read_to_string(web.join("app.ts")).unwrap(), "two\n");

        // Nothing changed: no second checkpoint.
        assert_eq!(create(&web, "Before prompt 2").unwrap(), None);
        fs::write(web.join("app.ts"), "three\n").unwrap();
        let second = create(&web, "Before prompt 3").unwrap().unwrap();
        let ids: Vec<_> = list(&web).unwrap().into_iter().map(|c| c.id).collect();
        assert_eq!(ids, vec![second.id, first.id]);
    }

    #[test]
    fn restores_a_checkpoint_and_can_undo_it() {
        let dir = repo();
        let web = dir.path().join("web");
        fs::write(web.join("draft.ts"), "draft\n").unwrap();
        let checkpoint = create(&web, "Before prompt").unwrap().unwrap();

        // The agent changes, adds and deletes files; ignored files stay.
        fs::write(web.join("app.ts"), "agent\n").unwrap();
        fs::write(web.join("added.ts"), "added\n").unwrap();
        fs::remove_file(web.join("keep.ts")).unwrap();
        fs::write(dir.path().join("ignored.log"), "log\n").unwrap();
        let mut changes = changes(&web, &checkpoint.id).unwrap();
        changes.sort_by(|a, b| a.path.cmp(&b.path));
        let summary: Vec<_> = changes
            .iter()
            .map(|f| (f.path.as_str(), f.change))
            .collect();
        assert_eq!(
            summary,
            vec![
                ("added.ts", CheckpointChange::Added),
                ("app.ts", CheckpointChange::Modified),
                ("keep.ts", CheckpointChange::Deleted),
            ]
        );

        let undo = restore(&web, &checkpoint.id).unwrap().unwrap();
        assert_eq!(fs::read_to_string(web.join("app.ts")).unwrap(), "one\n");
        assert_eq!(fs::read_to_string(web.join("keep.ts")).unwrap(), "keep\n");
        assert_eq!(fs::read_to_string(web.join("draft.ts")).unwrap(), "draft\n");
        assert!(!web.join("added.ts").exists());
        assert!(dir.path().join("ignored.log").exists());

        restore(&web, &undo.id).unwrap();
        assert_eq!(fs::read_to_string(web.join("app.ts")).unwrap(), "agent\n");
        assert!(web.join("added.ts").exists());
        assert!(!web.join("keep.ts").exists());
    }

    #[test]
    fn works_before_the_first_commit_and_outside_repositories() {
        let dir = tempfile::TempDir::new().unwrap();
        assert_eq!(create(dir.path(), "x").unwrap(), None);
        assert!(list(dir.path()).unwrap().is_empty());
        run(dir.path(), &["init", "-q"]);
        fs::write(dir.path().join("a.txt"), "a\n").unwrap();
        let checkpoint = create(dir.path(), "first").unwrap().unwrap();
        fs::write(dir.path().join("a.txt"), "b\n").unwrap();
        restore(dir.path(), &checkpoint.id).unwrap();
        assert_eq!(fs::read_to_string(dir.path().join("a.txt")).unwrap(), "a\n");
    }

    #[test]
    fn keeps_a_bounded_number_of_checkpoints() {
        let dir = repo();
        for n in 0..MAX_CHECKPOINTS + 3 {
            fs::write(dir.path().join("web/app.ts"), format!("{n}\n")).unwrap();
            create(dir.path(), "step").unwrap().unwrap();
        }
        assert_eq!(list(dir.path()).unwrap().len(), MAX_CHECKPOINTS);
    }

    #[test]
    fn rejects_unknown_ids() {
        let dir = repo();
        assert!(changes(dir.path(), "../../HEAD").is_err());
        assert!(restore(dir.path(), "123").is_err());
    }

    #[test]
    fn parses_name_status_inside_the_prefix() {
        let output = b"A\0web/a.ts\0M\0web/b.ts\0D\0other/c.ts\0";
        let files = parse_name_status(output, "web/");
        assert_eq!(
            files,
            vec![
                CheckpointFile {
                    path: "a.ts".into(),
                    change: CheckpointChange::Added
                },
                CheckpointFile {
                    path: "b.ts".into(),
                    change: CheckpointChange::Modified
                },
            ]
        );
    }
}
