//! File system access: lazy file tree, watcher, read/write, quick open and
//! text search.
//!
//! Nothing is indexed: directories are read when they are expanded and
//! searches walk the project on demand. `.gitignore` is always respected.

pub mod commands;
pub mod file;
pub mod path;
pub mod quick_open;
pub mod search;
pub mod tree;
pub mod walk;
pub mod watcher;
