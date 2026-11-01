//! Local branches: listing, the main branch and switching.

use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::cli::git;
use crate::error::{Error, Result};

/// Branches that count as the main line, in order of preference: `develop`
/// first (git-flow style projects work there), then the usual defaults.
const MAIN_CANDIDATES: [&str; 4] = ["develop", "main", "master", "trunk"];

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    pub name: String,
    pub current: bool,
    /// The remote branch it tracks, e.g. `origin/main`.
    pub upstream: Option<String>,
    /// Time of its last commit in milliseconds since the Unix epoch.
    pub committed_at: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Branches {
    /// Most recently committed first.
    pub branches: Vec<Branch>,
    /// The branch agents return to after cleaning up (see
    /// [`MAIN_CANDIDATES`]), `None` if none of them exists.
    pub main: Option<String>,
}

/// The local branches of the repository the project is in.
pub fn list(root: &Path) -> Result<Branches> {
    let output = git(
        root,
        &[
            "for-each-ref",
            "--sort=-committerdate",
            "--format=%(HEAD)%00%(refname:short)%00%(upstream:short)%00%(committerdate:unix)",
            "refs/heads",
        ],
    )?;
    let branches: Vec<Branch> = String::from_utf8_lossy(&output)
        .lines()
        .filter_map(parse_line)
        .collect();
    let main = main_branch(&branches, remote_default(root).as_deref());
    Ok(Branches { branches, main })
}

/// Switches to a local branch. Uncommitted changes are carried over; git
/// refuses (and nothing changes) when they would be overwritten.
pub fn switch(root: &Path, name: &str) -> Result<()> {
    if name.starts_with('-') || name.trim().is_empty() {
        return Err(Error::Git(format!("invalid branch name {name:?}")));
    }
    git(root, &["switch", "--no-guess", name]).map(drop)
}

fn parse_line(line: &str) -> Option<Branch> {
    let mut parts = line.split('\0');
    let head = parts.next()?;
    let name = parts.next()?.to_owned();
    let upstream = parts.next().filter(|u| !u.is_empty()).map(str::to_owned);
    let seconds: f64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0.0);
    Some(Branch {
        name,
        current: head == "*",
        upstream,
        committed_at: seconds * 1000.0,
    })
}

/// The branch `origin/HEAD` points to, e.g. `main`.
fn remote_default(root: &Path) -> Option<String> {
    let output = git(
        root,
        &[
            "symbolic-ref",
            "--quiet",
            "--short",
            "refs/remotes/origin/HEAD",
        ],
    )
    .ok()?;
    let full = String::from_utf8_lossy(&output).trim().to_owned();
    full.split_once('/').map(|(_, name)| name.to_owned())
}

fn main_branch(branches: &[Branch], remote_default: Option<&str>) -> Option<String> {
    let exists = |name: &str| branches.iter().any(|b| b.name == name);
    if exists("develop") {
        return Some("develop".to_owned());
    }
    if let Some(name) = remote_default.filter(|name| exists(name)) {
        return Some(name.to_owned());
    }
    MAIN_CANDIDATES
        .iter()
        .find(|name| exists(name))
        .map(|name| (*name).to_owned())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn run(dir: &Path, args: &[&str]) {
        git(dir, args).unwrap_or_else(|err| panic!("git {args:?}: {err}"));
    }

    fn repo() -> tempfile::TempDir {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path();
        run(root, &["init", "-q", "-b", "main"]);
        run(root, &["config", "user.email", "test@example.com"]);
        run(root, &["config", "user.name", "Test"]);
        fs::write(root.join("a.txt"), "a\n").unwrap();
        run(root, &["add", "."]);
        run(root, &["commit", "-q", "-m", "init"]);
        run(root, &["branch", "feature/x"]);
        dir
    }

    fn branch(name: &str) -> Branch {
        Branch {
            name: name.into(),
            current: false,
            upstream: None,
            committed_at: 0.0,
        }
    }

    #[test]
    fn lists_branches_and_switches() {
        let dir = repo();
        let listed = list(dir.path()).unwrap();
        let names: Vec<_> = listed.branches.iter().map(|b| b.name.as_str()).collect();
        assert!(
            names.contains(&"main") && names.contains(&"feature/x"),
            "{names:?}"
        );
        assert!(
            listed
                .branches
                .iter()
                .any(|b| b.name == "main" && b.current)
        );
        assert!(listed.branches[0].committed_at > 0.0);
        assert_eq!(listed.main.as_deref(), Some("main"));

        switch(dir.path(), "feature/x").unwrap();
        let after = list(dir.path()).unwrap();
        assert!(
            after
                .branches
                .iter()
                .any(|b| b.name == "feature/x" && b.current)
        );
    }

    #[test]
    fn refuses_options_and_unknown_branches() {
        let dir = repo();
        assert!(switch(dir.path(), "--detach").is_err());
        assert!(switch(dir.path(), "does-not-exist").is_err());
    }

    #[test]
    fn prefers_develop_then_the_remote_default_then_common_names() {
        let main = [branch("feature"), branch("main"), branch("develop")];
        assert_eq!(main_branch(&main, Some("main")).as_deref(), Some("develop"));
        let trunk = [branch("trunk"), branch("release")];
        assert_eq!(
            main_branch(&trunk, Some("release")).as_deref(),
            Some("release")
        );
        assert_eq!(main_branch(&trunk, None).as_deref(), Some("trunk"));
        assert_eq!(main_branch(&[branch("x")], None), None);
    }
}
