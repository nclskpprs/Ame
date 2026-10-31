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

- [ ] Open multiple projects, sidebar, layout restoration
- [ ] Base layout: panels (file tree · editor · terminal · changes) next to
      the sidebar from M0; density switch in the UI (the tokens already
      support comfortable / compact)
- [ ] Lazy file tree with watcher
- [ ] CodeMirror editor: view, edit, save; syntax highlighting for common
      languages (PHP, JS/TS, JSON, CSS, HTML, Markdown); theme derived from
      the design tokens; bundled JetBrains Mono
- [ ] Quick open (fuzzy) and text search
- [ ] 💡 Command palette (`Ctrl/Cmd+K`): projects, files, scripts, agents and
      commands in one input
- [ ] 💡 Project groups (e.g. _Client A_, _Private_) and pinning

## M2 — Terminals and agents

- [ ] PTY manager with ring buffer, xterm.js integration (WebGL with canvas
      fallback)
- [ ] Agent profiles (Claude Code, Codex, Gemini, Aider, generic shell) plus
      custom profiles; detect installed agents on the `PATH`
- [ ] Multiple sessions per project; sessions keep running in the background
- [ ] 💡 Background daemon: PTY sessions live in a small Rust process and
      survive a UI crash or close (like tmux)
- [ ] 💡 Session resume: a resume command per profile (e.g.
      `claude --continue`), one click after a restart
- [ ] 💡 "Send to agent": select code → `path:line-range` plus the selection
      is sent to the agent's terminal

## M3 — Status and dashboard

- [ ] Generic status detection (activity, CPU, BEL/OSC, exit)
- [ ] Profile patterns for `needs_input`
- [ ] Dashboard view, status dots in the sidebar
- [ ] OS notifications + dock/taskbar badge (configurable per project)
- [ ] Claude Code hooks adapter with helper CLI
- [ ] Rain status animations and the prompt drop (see `docs/DESIGN.md`)
- [ ] Performance benchmarks (RAM, startup time) in CI
- [ ] 💡 Prompt queue per agent: queue follow-up prompts that are sent
      automatically as soon as the agent is idle
- [ ] 💡 Resource monitor: RAM/CPU per project (agents + dev servers) in the
      sidebar

## M4 — Git and changes

- [ ] Git status, diff view, highlighting of changed files
- [ ] Follow mode
- [ ] Simple staging/commit (optional)
- [ ] 💡 Checkpoints before every prompt: automatic git snapshot on a hidden
      ref; roll back agent changes with one click
- [ ] 💡 Review mode: when an agent is done, walk through the diff,
      accept/discard hunks, send a comment on the diff directly as a prompt

## M5 — Scripts

- [ ] Detect `package.json` (package manager from lock file) and
      `composer.json`
- [ ] Script runner with status
- [ ] 💡 Dev server detection: detect ports in script output, "Open in
      browser" link, warn about port conflicts
- [ ] 💡 Project config `.ame.json`: default agents, start commands and
      favorite scripts per project, shareable with the team

## M6 — Release 0.1

- [ ] Icon and branding (a drop that is also a text cursor)
- [ ] UX review with screenshots of every view in light and dark
- [ ] Builds: `.dmg` (macOS universal), AppImage + `.deb` (Linux), installer +
      portable `.exe` (Windows)
- [ ] Release workflow per tag (`tauri-action`), auto-update
- [ ] Docs, screenshots, first publication

## Later

- Git worktrees for parallel agents in the same repo
- More UI languages (German first)
- Themes, keybinding configuration
- Optional LSP support (opt-in per project only)
- More adapters for agents with hook systems
- 💡 Broadcast prompt: send the same task to several projects (e.g. update
  dependencies)
- 💡 Prompt library: recurring prompts as snippets per project or global
- 💡 Focus mode: bundle notifications, report only `needs_input` immediately
- 💡 Push to phone: report status changes e.g. via ntfy or Pushover
- 💡 Token/cost display for agents that print their usage
- 💡 Plugin API: agent adapters and panels as plugins so the community can
  add new agents
