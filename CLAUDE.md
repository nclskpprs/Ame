@AGENTS.md

## Claude Code specifics

- `AGENTS.md` (imported above) is the single source of truth. Put project
  rules there, not here. This file only holds notes that are specific to
  Claude Code.
- To continue the project, a prompt like this is enough:
  "Read AGENTS.md, docs/PROGRESS.md and docs/ROADMAP.md, then start the next
  open milestone."
- The Claude Code status adapter uses Claude Code hooks, passed with
  `claude --settings` (ADR 0019). See _Agent status detection_ in
  `docs/ARCHITECTURE.md`.
