# 0015. Watch only visible directories

- **Status:** Replaced by [0024](0024-watch-whole-projects-where-it-is-cheap.md)
- **Date:** 2026-10-31

## Context

Agents change files all the time, so the file tree and open editors must
follow changes on disk. Watching a whole project recursively is cheap with
FSEvents (macOS) and ReadDirectoryChangesW (Windows), but on Linux inotify
needs one watch per directory. Repositories with `node_modules` or `target`
easily have tens of thousands of directories, which hits inotify limits and
costs memory — against the "no indexing, low RAM" principle.

## Decision

- The backend watches **only the directories the UI needs**, each
  **non-recursively**: the project root, expanded directories in the file
  tree and the directories of open editor tabs.
- The frontend sends the complete set per project with `watch_dirs`
  whenever it changes; the backend diffs it against the current watches.
- Events are debounced (150 ms, `notify-debouncer-mini`) and emitted as a
  typed `fs-changed` event with project-relative paths.
- Quick open and text search do not use the watcher; they walk the project
  on demand (quick open reuses its file list for 5 s).

## Consequences

- The number of OS watches stays small and independent of ignored folders.
- Changes in collapsed directories are not reported; they are picked up when
  the directory is expanded (it is re-read then).
- M4 (git status, follow mode) will need a different signal for changes in
  collapsed directories, e.g. polling `git status` while an agent works.
