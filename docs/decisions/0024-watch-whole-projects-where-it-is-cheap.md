# 0024. Watch whole projects where it is cheap

- **Status:** Accepted (replaces [0015](0015-watch-only-visible-directories.md))
- **Date:** 2026-11-02

## Context

ADR 0015 watched only the directories the UI shows. The macOS test showed
the cost: files an agent created in collapsed folders, new folders and
commits did not reach the file tree and the changes panel until the user
reloaded the app. Polling `git status` while an agent works covered only
part of it (not shells, not finished agents, not commits).

Recursive watching is cheap with FSEvents (macOS) and
`ReadDirectoryChangesW` (Windows): one OS handle per root, independent of
the number of directories. On Linux, inotify still needs one watch per
directory, which is what ADR 0015 avoided.

FSEvents reports real paths (symlinks resolved), so a project opened
through a symlinked path (e.g. `/tmp` → `/private/tmp`) got no events at
all with the old code.

## Decision

- **macOS and Windows:** the backend watches each project root
  **recursively**. Changes in paths excluded by the root `.gitignore` or
  `.git/info/exclude` are dropped in the backend, unless their folder is
  shown in the tree, so builds (`node_modules`, `target`) do not flood the
  UI. Nested `.gitignore` files are not read; their paths are reported,
  which costs a little and is never wrong. The rules are read again when
  `.gitignore` changes.
- **Linux:** unchanged, only the shown directories are watched
  non-recursively.
- **Everywhere:** `.git` is watched too. `HEAD`, `index`, `packed-refs` and
  `refs/heads/…` are reported (as `.git/…` paths); the frontend refreshes
  only the git status for them. Other paths inside `.git` (objects, locks,
  Ame's checkpoint refs) are dropped.
- Reported paths are made project-relative against the root as opened and
  against its canonical form.
- The frontend still sends the shown directories with `watch_dirs`; the
  backend decides what to watch per platform.

## Consequences

- File tree, open editors and the changes panel follow every change on
  macOS and Windows without a reload, also in collapsed folders.
- The frontend gets more events on these platforms; they are debounced
  (150 ms, at most one batch per second) and the tree only re-reads folders
  it has loaded, so the cost stays small. `git status` runs at most once per
  batch.
- Linux still relies on `pollGit` (every 3 s while an agent is busy) and
  the window focus for changes in collapsed folders, but now sees commits
  and checkouts through `.git`.
