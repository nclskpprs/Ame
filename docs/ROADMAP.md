# Roadmap

Milestones with checkboxes. Agents tick items when they are done and add new
items where needed. Ideas from the original plan are integrated into the
milestones and marked with 💡.

## M0 — Foundation

- [x] Repository, licenses, README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY,
      issue and PR templates
- [x] Tauri 2 + Svelte 5 + TypeScript scaffold with pnpm
- [x] Lint, format and test setup (Rust + frontend), pre-commit hooks
- [x] GitHub Actions: CI matrix macOS / Linux / Windows (first run happens
      with the first push)
- [x] i18n skeleton with `locales/en.json`
- [x] Settings storage including portable mode (Windows: config next to the
      `.exe` when a file named `portable` lies next to it)
- [x] AGENTS.md, CLAUDE.md, `docs/` structure
- [x] ADRs for the stack choices
- [x] Design tokens and both themes (Ame Dark, Ame Light)

## M1 — Project shell

- [x] Open multiple projects, sidebar, layout restoration
- [x] Base layout: resizable side panel (files · search) and editor area;
      density switch via the command palette. The terminal panel follows in
      M2, the changes panel in M4 (progressive disclosure).
- [x] Lazy file tree with watcher
- [x] CodeMirror editor: view, edit, save; syntax highlighting for common
      languages (PHP, JS/TS, JSON, CSS, HTML, Markdown, and since then
      Python, Rust, Go, Java, C/C++, SQL, YAML, TOML, shell and more);
      theme derived from the design tokens; bundled JetBrains Mono
- [x] Quick open (fuzzy) and text search
- [x] 💡 Command palette (`Ctrl/Cmd+K`): projects, files and commands in one
      input (scripts follow in M5, agents in M2)
- [x] 💡 Project groups (e.g. _Client A_, _Private_) and pinning
- [x] File type icons in the tree and tabs (Material Icon Theme subset,
      maintainer request)

## M2 — Terminals and agents

- [x] PTY manager with ring buffer, xterm.js integration (WebGL with DOM
      renderer fallback; xterm.js 6 has no canvas renderer)
- [x] Agent profiles (Claude Code, Codex, Gemini, OpenCode, Aider, generic
      shell) plus custom profiles; detect installed agents on the `PATH`
- [x] Multiple sessions per project; sessions keep running in the background
- [x] Keep running in the background (maintainer decision, ADR 0020):
      closing the window hides it while agents run; tray icon with the
      sessions, single instance, Mod+Q quits and ends all sessions and
      everything they started
- [x] Start the preferred agent automatically when a project is shown
      (maintainer request; setting, off by default)
- [x] 💡 Session resume: a resume command per profile (e.g.
      `claude --continue`), one click after a restart
- [x] 💡 "Send to agent": select code → `path:line-range` plus the selection
      is sent to the agent's terminal

## M3 — Status and dashboard

- [x] Generic status detection (activity, CPU, BEL/OSC, exit)
- [x] Profile patterns for `needs_input`
- [x] Dashboard view, status dots in the sidebar
- [x] OS notifications + dock/taskbar badge (configurable per project)
- [x] Claude Code hooks adapter with helper CLI
- [x] Rain status animations and the prompt drop (see `docs/DESIGN.md`)
- [x] Origami motif (maintainer idea): paper crane for queued prompts and
      a hidden "Dance of the Paper" easter egg in the palette
- [x] Performance benchmarks (RAM, startup time) in CI; budgets per
      platform (ADR 0022)
- [x] 💡 Prompt queue per agent: queue follow-up prompts that are sent
      automatically as soon as the agent is idle
- [x] 💡 Resource monitor: RAM/CPU per project (agents + dev servers) in the
      sidebar

## M4 — Git and changes

- [x] Git status, diff view, highlighting of changed files
- [x] Follow mode
- [x] Simple staging/commit (optional)
- [x] Branches: list and switch (maintainer request); ready-made prompt
      "clean up branches and return to the main branch" for one agent or a
      project group
- [x] Prompt library (maintainer request): own prompts with `{project}`,
      `{branch}`, `{main}`, sent with "Send Prompt…" to the project's agent
      or the project group
- [x] 💡 Checkpoints before every prompt: automatic git snapshot on a hidden
      ref; roll back agent changes with one click (ADR 0023)
- [ ] 💡 Review mode: when an agent is done, walk through the diff,
      accept/discard hunks, send a comment on the diff directly as a prompt

## M5 — Scripts

- [x] Detect `package.json` (package manager from lock file) and
      `composer.json`
- [x] Script runner with status
- [ ] 💡 Dev server detection: detect ports in script output, "Open in
      browser" link, warn about port conflicts
- [ ] 💡 Project config `.ame.json`: default agents, start commands and
      favorite scripts per project, shareable with the team

## M5b — Project groups for agents (maintainer idea)

- [x] Start an agent for a whole group: it runs in a chosen project and
      gets the other folders of the group (e.g. Claude Code `--add-dir`,
      Gemini CLI `--include-directories`), so it knows the projects belong
      together and can work across them
- [x] Broadcast prompt to a group: send the same task to the agents of all
      projects in a group (moved up from "Later")
- [x] Group view in the dashboard: status of all agents of a group at a
      glance

## M6 — Release 0.1

- [x] Icon and branding (a drop that is also a text cursor;
      source `branding/icon.svg`)
- [x] UX review with screenshots of every view in light and dark (main
      views; see PROGRESS)
- [x] Builds: `.dmg` (macOS universal), AppImage + `.deb` (Linux), installer +
      portable `.exe` (Windows) — in the release workflow, not run yet
- [x] Release workflow per tag (`tauri-action`), see `docs/RELEASING.md`;
      auto-update follows with the in-app updates
- [x] Preview workflow: rolling pre-release "Ame Preview" built by hand
      from a branch, no version bump (`docs/RELEASING.md`)
- [x] In-app updates (maintainer request): check on start and every 6 h
      (setting + "Check for Updates" command), sidebar notice and OS
      notification, "Install and restart" with `tauri-plugin-updater` and
      signed GitHub release artifacts; portable, `.deb`/`.rpm` and debug
      builds get a download link (ADR 0026)
- [ ] Docs, screenshots, first publication — README and screenshots
      updated; publication waits for the first release

## M6b — macOS test feedback (maintainer, 2026-11-02)

- [x] Shift+Enter inserts a line break in agent prompts
- [x] Show files excluded by `.gitignore` (setting + command), dimmed
- [x] File operations in the tree: new file/folder, rename/move (also by
      drag and drop), move to the trash with inline confirmation
- [x] App zoom with Mod+Plus / Mod+Minus, reset with Mod+0
- [x] Unread agent results (sidebar, tabs, dashboard), "Mark as Unread",
      jump to the next unread result (Mod+Shift+U)
- [x] No manual reload: recursive watching on macOS/Windows, `.git` state
      changes everywhere (ADR 0024)
- [x] The terminal panel stays on the session used last (also after
      closing a tab and across restarts)
- [x] Buttons to show the terminal panel and start a shell or an agent
      without the keyboard

## M6c — Working-day feedback (maintainer, 2026-11-03)

- [x] Reveal files, folders and projects in Finder / Explorer / the file
      manager (context menus and palette)
- [x] Copy the absolute (and for files the relative) path from the
      context menus and the palette
- [x] Script runs never become unread; unread marks are for agents and
      shells only
- [x] Groups are framed in the sidebar; drag and drop projects into, out
      of and between groups (and onto the pinned list)
- [x] 💡 Board (moved up from _Later_, needed for 0.1.0): work packages
      per project, prepared from configurable templates, started by hand
      with a picked agent (ADR 0025)
- [x] The 0.1.0 release (published 2026-11-03; updater tested from 0.0.0 to 0.1.0)

## M7 — Navigation and UX feedback (maintainer, 2026-11-08)

- [x] The sidebar navigates like pages: one current entry, clicks show a
      page instead of toggling it
- [x] The board is reachable by mouse (sidebar entry, project menu)
- [x] Fold and unfold project groups (remembered, status stays visible)
- [x] One button system with hover, press and disabled states
- [x] Component tests for the sidebar and the view (ADR 0027)
- [ ] 💡 End-to-end tests with `tauri-driver` in a Linux CI job
- [ ] Maintainer test in a preview build

## Later

- 💡 Background daemon: PTY sessions live in a small Rust process and
  survive a crash of the app (like tmux); replaced for 0.1 by ADR 0020

- Virtualized rendering for very large directories and search results
- Git worktrees for parallel agents in the same repo
- More UI languages (German first)
- Themes, keybinding configuration
- Optional LSP support (opt-in per project only)
- More adapters for agents with hook systems
- 💡 Prompt library per project (`.ame.json`); the global library is done
- 💡 Focus mode: bundle notifications, report only `needs_input` immediately
- 💡 Push to phone: report status changes e.g. via ntfy or Pushover
- 💡 Token/cost display for agents that print their usage
- 💡 Plugin API: agent adapters and panels as plugins so the community can
  add new agents
