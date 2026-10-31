//! File system access: lazy file tree, watcher and read/write.
//!
//! Directories are only read when they are expanded and `.gitignore` is
//! respected. Search and quick open follow in this module.

pub mod commands;
pub mod file;
pub mod path;
pub mod tree;
pub mod watcher;
