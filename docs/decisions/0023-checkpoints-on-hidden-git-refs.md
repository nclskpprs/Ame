# 0023. Checkpoints on hidden git refs

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Agents change many files per prompt. M4 asks for a checkpoint before every
prompt, so the user can roll back what an agent did with one action,
without the agent's cooperation and without disturbing the user's own git
workflow (branch, index, history).

## Decision

- A checkpoint is a **commit on a hidden ref**
  `refs/ame/checkpoints/<project key>/<zero-padded milliseconds>`, made with
  a **temporary copy of the index**: `git add -A` (respects `.gitignore`),
  `write-tree`, `commit-tree` (parent `HEAD`, author "Ame"),
  `update-ref`. `HEAD`, the real index and the working tree are untouched;
  `git log` and `git status` do not show it.
- **When:** the PTY status loop reports every submitted prompt (Enter
  outside a paste) of an agent session — not of the plain shell — and the
  backend takes a checkpoint on a background thread, unless the setting
  `checkpoints` is off. A checkpoint whose tree equals the previous one is
  not stored. 50 are kept per project. More than 2000 untracked, not
  ignored files skip the snapshot (a missing `.gitignore` for
  `node_modules` would copy everything into the object store).
- **Restore** (changes panel, inline confirmation): files changed or
  deleted since the checkpoint come back with
  `git restore --source=<checkpoint> --worktree`, files added since are
  deleted. Only the project folder is restored when it is a subfolder of a
  repository. A checkpoint of the state before is taken first and offered
  as **Undo**.
- The project key is a hash of the project's path inside the repository,
  so projects in one repository keep separate lists.

## Alternatives considered

- **`git stash create`:** does not include untracked files without
  `-u`, and `stash create -u` is not supported; stashes are also visible
  to the user.
- **Copying files to a folder:** no deduplication, and the size grows with
  every prompt.
- **A ref per session:** the user thinks in projects; one list per
  project is easier to read.

## Consequences

- Checkpoints only exist in git repositories.
- Objects of checkpoints stay in the repository until git's garbage
  collection removes them after their refs are pruned.
- A checkpoint is taken up to one status tick (250 ms) after Enter; an
  agent that edits files faster than that would have its first edit in
  the checkpoint (not seen in practice).
