//! Project-relative paths. The frontend always uses `/` as separator and
//! never sees absolute paths of files inside a project.

use std::path::{Component, Path, PathBuf};

use crate::error::{Error, Result};

/// Resolves a project-relative path inside `root`. Rejects anything that
/// could escape the project (`..`, absolute paths, drive prefixes).
pub fn resolve(root: &Path, rel: &str) -> Result<PathBuf> {
    if rel.starts_with('/') {
        return Err(Error::PathOutsideProject(rel.to_owned()));
    }
    let mut path = root.to_path_buf();
    for part in rel
        .split('/')
        .filter(|part| !part.is_empty() && *part != ".")
    {
        let mut components = Path::new(part).components();
        let valid = matches!(components.next(), Some(Component::Normal(_)))
            && components.next().is_none()
            && !part.contains(['\\', ':']);
        if !valid {
            return Err(Error::PathOutsideProject(rel.to_owned()));
        }
        path.push(part);
    }
    Ok(path)
}

/// Converts a path inside `root` to a project-relative path with `/`
/// separators. Returns `None` for paths outside of `root`.
pub fn relative(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let parts: Vec<_> = rel
        .components()
        .map(|component| component.as_os_str().to_string_lossy())
        .collect();
    Some(parts.join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_relative_paths() {
        let root = Path::new("/project");
        assert_eq!(resolve(root, "").unwrap(), PathBuf::from("/project"));
        assert_eq!(
            resolve(root, "src/./main.rs").unwrap(),
            Path::new("/project").join("src").join("main.rs")
        );
    }

    #[test]
    fn rejects_escaping_paths() {
        let root = Path::new("/project");
        for rel in [
            "..",
            "src/../../etc",
            "/etc/passwd",
            "C:/Windows",
            "a\\..\\b",
        ] {
            assert!(
                matches!(resolve(root, rel), Err(Error::PathOutsideProject(_))),
                "{rel}"
            );
        }
    }

    #[test]
    fn converts_back_to_relative() {
        let root = Path::new("/project");
        let path = root.join("src").join("lib.rs");
        assert_eq!(relative(root, &path).as_deref(), Some("src/lib.rs"));
        assert_eq!(relative(root, root).as_deref(), Some(""));
        assert_eq!(relative(root, Path::new("/other")), None);
    }
}
