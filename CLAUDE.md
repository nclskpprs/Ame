@AGENTS.md

## Claude Code specifics

- `AGENTS.md` (imported above) is the single source of truth. Put project
  rules there, not here. This file only holds notes that are specific to
  Claude Code.
- To continue the project, a prompt like this is enough:
  "Read AGENTS.md, docs/PROGRESS.md and docs/ROADMAP.md, then start the next
  open milestone."
- The Claude Code status adapter planned for M3 uses Claude Code hooks
  (`UserPromptSubmit`, `Notification`, `Stop`, `SessionStart`,
  `SessionEnd`). See *Agent status detection* in `docs/ARCHITECTURE.md`.
