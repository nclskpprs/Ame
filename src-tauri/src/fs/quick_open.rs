//! Fuzzy file search for quick open. No index: the file list is collected on
//! demand and reused only for a few seconds while the user types.

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use nucleo_matcher::pattern::{CaseMatching, Normalization, Pattern};
use nucleo_matcher::{Config, Matcher, Utf32Str};
use serde::Serialize;
use specta::Type;

use super::path::relative;
use super::walk::project_walker;

/// How long a collected file list is reused.
const CACHE_TTL: Duration = Duration::from_secs(5);

/// Upper bound for the number of files collected per project.
const MAX_FILES: usize = 200_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileMatch {
    pub path: String,
    /// Indices of matched characters (Unicode scalar values) in `path`.
    pub indices: Vec<u32>,
}

/// A collected file list and when it was collected.
type CachedFiles = (Instant, Arc<Vec<String>>);

/// Short-lived file lists per project. Managed as Tauri state.
#[derive(Default)]
pub struct QuickOpen {
    cache: Mutex<HashMap<String, CachedFiles>>,
}

impl QuickOpen {
    pub fn search(&self, project: &str, root: &Path, query: &str, limit: usize) -> Vec<FileMatch> {
        let files = self.files(project, root);
        fuzzy_match(&files, query, limit)
    }

    fn files(&self, project: &str, root: &Path) -> Arc<Vec<String>> {
        let mut cache = self
            .cache
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some((time, files)) = cache.get(project)
            && time.elapsed() < CACHE_TTL
        {
            return Arc::clone(files);
        }
        let files = Arc::new(list_files(root));
        cache.insert(project.to_owned(), (Instant::now(), Arc::clone(&files)));
        files
    }
}

/// All files of a project as relative paths, sorted.
pub fn list_files(root: &Path) -> Vec<String> {
    let mut files: Vec<String> = project_walker(root)
        .build()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_some_and(|kind| kind.is_file()))
        .filter_map(|entry| relative(root, entry.path()))
        .take(MAX_FILES)
        .collect();
    files.sort();
    files
}

/// Ranks `files` against `query`. An empty query returns the first files.
pub fn fuzzy_match(files: &[String], query: &str, limit: usize) -> Vec<FileMatch> {
    if query.trim().is_empty() {
        return files
            .iter()
            .take(limit)
            .map(|path| FileMatch {
                path: path.clone(),
                indices: Vec::new(),
            })
            .collect();
    }

    let mut matcher = Matcher::new(Config::DEFAULT.match_paths());
    let pattern = Pattern::parse(query, CaseMatching::Smart, Normalization::Smart);
    let mut buf = Vec::new();
    let mut scored: Vec<(u32, &String)> = files
        .iter()
        .filter_map(|path| {
            let score = pattern.score(Utf32Str::new(path, &mut buf), &mut matcher)?;
            Some((score, path))
        })
        .collect();
    // Best score first; shorter paths win ties.
    scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.len().cmp(&b.1.len())));

    scored
        .into_iter()
        .take(limit)
        .map(|(_, path)| {
            let mut indices = Vec::new();
            pattern.indices(Utf32Str::new(path, &mut buf), &mut matcher, &mut indices);
            indices.sort_unstable();
            indices.dedup();
            FileMatch {
                path: path.clone(),
                indices,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn paths(matches: &[FileMatch]) -> Vec<&str> {
        matches.iter().map(|m| m.path.as_str()).collect()
    }

    #[test]
    fn lists_files_respecting_ignore_rules() {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src/lib")).unwrap();
        fs::create_dir_all(root.join("node_modules/x")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join(".gitignore"), "node_modules\n").unwrap();
        fs::write(root.join("src/lib/a.ts"), "").unwrap();
        fs::write(root.join("node_modules/x/index.js"), "").unwrap();
        fs::write(root.join(".git/HEAD"), "").unwrap();

        assert_eq!(list_files(root), [".gitignore", "src/lib/a.ts"]);
    }

    #[test]
    fn ranks_fuzzy_matches() {
        let files: Vec<String> = [
            "src/lib/components/Sidebar.svelte",
            "src/lib/stores/settings.svelte.ts",
            "docs/ROADMAP.md",
        ]
        .map(String::from)
        .to_vec();

        let matches = fuzzy_match(&files, "sidebar", 10);
        assert_eq!(paths(&matches), ["src/lib/components/Sidebar.svelte"]);
        assert_eq!(matches[0].indices.len(), 7);

        let matches = fuzzy_match(&files, "settings", 10);
        assert_eq!(paths(&matches)[0], "src/lib/stores/settings.svelte.ts");

        assert!(fuzzy_match(&files, "zzz", 10).is_empty());
    }

    #[test]
    fn empty_query_returns_first_files() {
        let files: Vec<String> = ["a", "b", "c"].map(String::from).to_vec();
        assert_eq!(paths(&fuzzy_match(&files, " ", 2)), ["a", "b"]);
    }
}
