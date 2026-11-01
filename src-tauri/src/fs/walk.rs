//! Walking a project like the file tree does (ignore rules, no `.git`).

use std::path::Path;

use ignore::WalkBuilder;

/// A walker over all files of a project that respects the ignore rules.
pub fn project_walker(root: &Path) -> WalkBuilder {
    let mut builder = WalkBuilder::new(root);
    builder
        .hidden(false)
        .require_git(false)
        .filter_entry(|entry| entry.file_name() != ".git");
    builder
}
