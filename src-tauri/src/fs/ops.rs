//! File operations from the file tree: create, move (and rename) and move
//! to the trash. Paths are project-relative; nothing can leave the project.

use std::fs;
use std::path::Path;

use super::path::resolve;
use crate::error::{Error, Result};
use crate::fs::tree::EntryKind;

/// Creates an empty file or a folder, and missing parent folders.
pub fn create_entry(root: &Path, rel: &str, kind: EntryKind) -> Result<()> {
    let path = resolve_entry(root, rel)?;
    if path.exists() {
        return Err(Error::AlreadyExists(rel.to_owned()));
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    match kind {
        EntryKind::Dir => fs::create_dir(&path)?,
        EntryKind::File => {
            fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)?;
        }
    }
    Ok(())
}

/// Moves or renames a file or folder; missing parent folders of the target
/// are created. Never replaces an existing entry.
pub fn move_entry(root: &Path, from: &str, to: &str) -> Result<()> {
    let source = resolve_entry(root, from)?;
    let target = resolve_entry(root, to)?;
    if fs::symlink_metadata(&source).is_err() {
        return Err(Error::NotFound(from.to_owned()));
    }
    if target.starts_with(&source) {
        return Err(Error::InvalidMove(to.to_owned()));
    }
    // A case-only rename is the same entry on case-insensitive file systems.
    let same_entry = from.to_lowercase() == to.to_lowercase();
    if target.exists() && !same_entry {
        return Err(Error::AlreadyExists(to.to_owned()));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(&source, &target)?;
    Ok(())
}

/// Moves a file or folder to the trash of the operating system, so it can
/// be restored from there.
pub fn trash_entry(root: &Path, rel: &str) -> Result<()> {
    let path = resolve_entry(root, rel)?;
    if fs::symlink_metadata(&path).is_err() {
        return Err(Error::NotFound(rel.to_owned()));
    }
    #[allow(unused_mut)]
    let mut context = trash::TrashContext::default();
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        // The Finder method asks for permission to control the Finder.
        context.set_delete_method(DeleteMethod::NsFileManager);
    }
    context
        .delete(&path)
        .map_err(|err| Error::Io(err.to_string()))
}

/// Resolves a path below the project root; the root itself is not an entry.
fn resolve_entry(root: &Path, rel: &str) -> Result<std::path::PathBuf> {
    let path = resolve(root, rel)?;
    if path == root {
        return Err(Error::PathOutsideProject(rel.to_owned()));
    }
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn creates_files_and_folders_with_parents() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        create_entry(root, "a/b/new.txt", EntryKind::File).unwrap();
        create_entry(root, "c/d", EntryKind::Dir).unwrap();
        assert!(root.join("a/b/new.txt").is_file());
        assert!(root.join("c/d").is_dir());
        assert!(matches!(
            create_entry(root, "a/b/new.txt", EntryKind::File),
            Err(Error::AlreadyExists(_))
        ));
    }

    #[test]
    fn moves_folders_without_replacing() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src/lib")).unwrap();
        fs::write(root.join("src/lib/a.rs"), "a").unwrap();
        fs::write(root.join("b.rs"), "b").unwrap();

        move_entry(root, "src/lib", "core/lib").unwrap();
        assert_eq!(fs::read_to_string(root.join("core/lib/a.rs")).unwrap(), "a");
        assert!(!root.join("src/lib").exists());

        assert!(matches!(
            move_entry(root, "b.rs", "core/lib/a.rs"),
            Err(Error::AlreadyExists(_))
        ));
        assert!(matches!(
            move_entry(root, "core", "core/lib/inner"),
            Err(Error::InvalidMove(_))
        ));
        assert!(matches!(
            move_entry(root, "missing", "x"),
            Err(Error::NotFound(_))
        ));
        move_entry(root, "b.rs", "B.rs").unwrap();
        assert_eq!(fs::read_to_string(root.join("B.rs")).unwrap(), "b");
    }

    #[test]
    fn never_touches_the_root_or_outside() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        assert!(matches!(
            trash_entry(root, ""),
            Err(Error::PathOutsideProject(_))
        ));
        assert!(matches!(
            move_entry(root, "../x", "y"),
            Err(Error::PathOutsideProject(_))
        ));
        assert!(matches!(
            trash_entry(root, "missing"),
            Err(Error::NotFound(_))
        ));
    }
}
