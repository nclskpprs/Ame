//! Lazy directory listing for the file tree.

use std::path::Path;

use ignore::WalkBuilder;
use serde::Serialize;
use specta::Type;

use super::path::{relative, resolve};
use crate::error::{Error, Result};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    /// Project-relative path with `/` separators.
    pub path: String,
    pub kind: EntryKind,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum EntryKind {
    File,
    Dir,
}

/// Lists one directory. Respects `.gitignore`, `.ignore` and the global git
/// excludes, shows dotfiles, hides `.git`. Directories come first, then
/// files, each sorted case-insensitively.
pub fn read_dir(root: &Path, rel: &str) -> Result<Vec<DirEntry>> {
    let dir = resolve(root, rel)?;
    if !dir.is_dir() {
        return Err(Error::NotADirectory(rel.to_owned()));
    }

    let walker = WalkBuilder::new(&dir)
        .max_depth(Some(1))
        .hidden(false)
        .require_git(false)
        .filter_entry(|entry| entry.file_name() != ".git")
        .build();

    let mut entries: Vec<DirEntry> = walker
        .skip(1) // the directory itself
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let path = relative(root, entry.path())?;
            let kind = if entry.path().is_dir() {
                EntryKind::Dir
            } else {
                EntryKind::File
            };
            Some(DirEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path,
                kind,
            })
        })
        .collect();

    entries.sort_by(|a, b| {
        (a.kind != EntryKind::Dir, a.name.to_lowercase(), &a.name).cmp(&(
            b.kind != EntryKind::Dir,
            b.name.to_lowercase(),
            &b.name,
        ))
    });
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn names(entries: &[DirEntry]) -> Vec<&str> {
        entries.iter().map(|e| e.name.as_str()).collect()
    }

    #[test]
    fn lists_dirs_first_and_sorted() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("src")).unwrap();
        fs::create_dir(root.join("Assets")).unwrap();
        fs::write(root.join("b.txt"), "").unwrap();
        fs::write(root.join("A.md"), "").unwrap();
        fs::write(root.join(".env"), "").unwrap();

        let entries = read_dir(root, "").unwrap();
        assert_eq!(names(&entries), ["Assets", "src", ".env", "A.md", "b.txt"]);
        assert_eq!(entries[1].kind, EntryKind::Dir);
        assert_eq!(entries[1].path, "src");
    }

    #[test]
    fn respects_gitignore_and_hides_git_dir() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        fs::create_dir(root.join(".git")).unwrap();
        fs::create_dir_all(root.join("target/debug")).unwrap();
        fs::create_dir(root.join("src")).unwrap();
        fs::write(root.join(".gitignore"), "/target\n*.log\n").unwrap();
        fs::write(root.join("src/app.log"), "").unwrap();
        fs::write(root.join("src/main.rs"), "").unwrap();

        assert_eq!(names(&read_dir(root, "").unwrap()), ["src", ".gitignore"]);
        let nested = read_dir(root, "src").unwrap();
        assert_eq!(names(&nested), ["main.rs"]);
        assert_eq!(nested[0].path, "src/main.rs");
    }

    #[test]
    fn rejects_files_and_escapes() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("file.txt"), "").unwrap();
        assert!(matches!(
            read_dir(dir.path(), "file.txt"),
            Err(Error::NotADirectory(_))
        ));
        assert!(matches!(
            read_dir(dir.path(), ".."),
            Err(Error::PathOutsideProject(_))
        ));
    }
}
