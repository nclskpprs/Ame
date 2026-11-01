//! `git status --porcelain=v2` parsing.

use serde::{Deserialize, Serialize};
use specta::Type;

/// Branch and changed files of a project.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    /// Current branch, `None` when detached.
    pub branch: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub files: Vec<GitFile>,
}

/// A changed file, with project-relative paths (`/` separators).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitFile {
    pub path: String,
    /// The previous path of a renamed or copied file.
    pub orig_path: Option<String>,
    /// Change in the index (staged), if any.
    pub staged: Option<Change>,
    /// Change in the working tree (not staged), if any.
    pub unstaged: Option<Change>,
    /// Last modification of the file on disk (ms since the Unix epoch), to
    /// notice files an agent just changed. `None` for deleted files.
    pub modified: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Change {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
    Untracked,
    Conflicted,
}

fn change(code: u8) -> Option<Change> {
    match code {
        b'A' => Some(Change::Added),
        b'M' => Some(Change::Modified),
        b'D' => Some(Change::Deleted),
        b'R' => Some(Change::Renamed),
        b'C' => Some(Change::Copied),
        b'T' => Some(Change::TypeChanged),
        b'U' => Some(Change::Conflicted),
        _ => None,
    }
}

/// Parses `git status --porcelain=v2 -z --branch`. Paths are relative to
/// the repository root; `prefix` (the project folder inside the repository,
/// e.g. `web/`) is removed and files outside of it are skipped.
pub fn parse(output: &[u8], prefix: &str) -> GitStatus {
    let mut status = GitStatus::default();
    let mut fields = output
        .split(|&byte| byte == 0)
        .map(|field| String::from_utf8_lossy(field).into_owned());
    let relative = |path: &str| path.strip_prefix(prefix).map(str::to_owned);

    while let Some(entry) = fields.next() {
        if let Some(header) = entry.strip_prefix("# ") {
            if let Some(head) = header.strip_prefix("branch.head ") {
                status.branch = (head != "(detached)").then(|| head.to_owned());
            } else if let Some(counts) = header.strip_prefix("branch.ab ") {
                for count in counts.split(' ') {
                    if let Some(ahead) = count.strip_prefix('+') {
                        status.ahead = ahead.parse().unwrap_or(0);
                    } else if let Some(behind) = count.strip_prefix('-') {
                        status.behind = behind.parse().unwrap_or(0);
                    }
                }
            }
            continue;
        }
        let kind = entry.as_bytes().first().copied();
        let file = match kind {
            Some(b'1' | b'2' | b'u') => {
                // Fields before the path: 1 → 8, 2 → 9, u → 10.
                let skip = match kind {
                    Some(b'1') => 8,
                    Some(b'2') => 9,
                    _ => 10,
                };
                let mut parts = entry.splitn(skip + 1, ' ');
                let xy = parts.nth(1).unwrap_or("..").as_bytes().to_vec();
                let Some(path) = parts.nth(skip - 2) else {
                    continue;
                };
                let orig_path = if kind == Some(b'2') {
                    fields.next()
                } else {
                    None
                };
                let Some(path) = relative(path) else { continue };
                let (staged, unstaged) = if kind == Some(b'u') {
                    (None, Some(Change::Conflicted))
                } else {
                    (
                        change(xy.first().copied().unwrap_or(b'.')),
                        change(xy.get(1).copied().unwrap_or(b'.')),
                    )
                };
                GitFile {
                    path,
                    orig_path: orig_path.and_then(|orig| relative(&orig)),
                    staged,
                    unstaged,
                    modified: None,
                }
            }
            Some(b'?') => {
                let Some(path) = relative(&entry[2..]) else {
                    continue;
                };
                GitFile {
                    path,
                    orig_path: None,
                    staged: None,
                    unstaged: Some(Change::Untracked),
                    modified: None,
                }
            }
            _ => continue,
        };
        if !file.path.is_empty() {
            status.files.push(file);
        }
    }
    status
}

#[cfg(test)]
mod tests {
    use super::*;

    fn output(entries: &[&str]) -> Vec<u8> {
        let mut bytes = Vec::new();
        for entry in entries {
            bytes.extend_from_slice(entry.as_bytes());
            bytes.push(0);
        }
        bytes
    }

    const HASH: &str = "0123456789012345678901234567890123456789";

    #[test]
    fn parses_branch_and_changes() {
        let modified = format!("1 .M N... 100644 100644 100644 {HASH} {HASH} src/main.rs");
        let added = format!("1 A. N... 000000 100644 100644 {HASH} {HASH} new file.txt");
        let renamed = format!("2 R. N... 100644 100644 100644 {HASH} {HASH} R100 b.txt");
        let conflict = format!("u UU N... 100644 100644 100644 100644 {HASH} {HASH} {HASH} c.txt");
        let status = parse(
            &output(&[
                "# branch.oid abc",
                "# branch.head main",
                "# branch.upstream origin/main",
                "# branch.ab +2 -1",
                &modified,
                &added,
                &renamed,
                "a.txt",
                &conflict,
                "? notes/todo.md",
            ]),
            "",
        );
        assert_eq!(status.branch.as_deref(), Some("main"));
        assert_eq!((status.ahead, status.behind), (2, 1));
        let summary: Vec<_> = status
            .files
            .iter()
            .map(|f| (f.path.as_str(), f.staged, f.unstaged))
            .collect();
        assert_eq!(
            summary,
            vec![
                ("src/main.rs", None, Some(Change::Modified)),
                ("new file.txt", Some(Change::Added), None),
                ("b.txt", Some(Change::Renamed), None),
                ("c.txt", None, Some(Change::Conflicted)),
                ("notes/todo.md", None, Some(Change::Untracked)),
            ]
        );
        assert_eq!(status.files[2].orig_path.as_deref(), Some("a.txt"));
    }

    #[test]
    fn strips_the_project_prefix() {
        let inside = format!("1 .M N... 100644 100644 100644 {HASH} {HASH} web/src/app.ts");
        let outside = format!("1 .M N... 100644 100644 100644 {HASH} {HASH} api/main.go");
        let status = parse(
            &output(&["# branch.head (detached)", &inside, &outside, "? web/x"]),
            "web/",
        );
        assert_eq!(status.branch, None);
        let paths: Vec<_> = status.files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(paths, vec!["src/app.ts", "x"]);
    }

    #[test]
    fn empty_output() {
        assert_eq!(parse(b"", ""), GitStatus::default());
    }
}
