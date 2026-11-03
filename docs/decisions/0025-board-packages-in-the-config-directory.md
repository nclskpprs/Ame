# 0025. Board packages in the config directory

- **Status:** Accepted
- **Date:** 2026-11-03

## Context

The maintainer wants a board before 0.1.0: work packages with a title,
a ticket and a description, prepared ahead of time and handed to agents.
Their answers (2026-11-03):

- Packages are **local to the user**, not shared with a team.
- A package is a **prompt prepared once** and worked through once.
- Its fields should be **configurable**, with **templates**.
- **Started by hand**, and the user **picks the agent** every time.
- **One board per project.**

## Decision

- **Storage:** `board.json` in the config directory (next to
  `settings.json` and `workspace.json`), one list of packages with the
  project path in each, managed by `BoardStore` (`src-tauri/src/board/`).
  Commands: `list_packages`, `save_package` (add or replace by id, only for
  open projects) and `delete_package`. Packages of a closed project stay
  and come back when it is opened again.
- **Package:** id (UUID from the frontend), project, template id, title,
  field values by field id, state (`open` → `started` → `done`), creation
  and start time, and the name of the agent it went to.
- **Templates** live in `settings.templates` (name, fields with label and
  single/multi-line, prompt). Without any, the frontend uses a built-in
  "Task" template (Ticket, Description); editing it saves it as an own
  template. Field values are stored under a stable field id, so renaming a
  label keeps them.
- **Prompt:** `{title}` and `{<field label>}` (case-insensitive) are filled
  in; `{project}`, `{branch}` and `{main}` work like in the prompt library.
  A line whose placeholders are all empty is dropped, and filled fields the
  prompt does not mention are appended (`lib/board/templates.ts`).
- **Start:** the palette offers the project's running agents ("Send to …")
  and every profile ("Start …"). The prompt goes through the prompt queue
  (ADR 0021), so a busy or starting agent gets it when it is idle. The
  package becomes _started_; _done_ is set by hand. The link from a package
  to its session lasts for the app run only, like the sessions themselves.
- **UI:** an overlay like the dashboard (`Board.svelte`, Mod+Shift+B) with
  three columns; packages are edited inline; no modal dialogs.

## Alternatives considered

- **A file in the project (`.ame/board.json`):** shareable, but shows up
  in `git status` and needs an ignore rule; the maintainer wants it local.
- **Packages in `settings.json`:** settings are rewritten as a whole on
  every change and hold preferences, not work items.
- **Automatic processing (next package when the agent is idle):** declined
  by the maintainer for now; the prompt queue already covers chained
  prompts for one agent.

## Consequences

- No new dependency; the board costs nothing until it is opened.
- Packages are not synced between machines and not shared with a team.
- Whether a package is finished is the user's call; Ame does not try to
  detect it from the agent state.
