# Vision and Principles

## Goal

Ame is a lean, cross-platform desktop app that keeps several projects open at
the same time and runs any terminal coding agent per project — Claude Code,
Codex CLI, Gemini CLI, Aider, OpenCode and others. It is not an IDE
replacement with indexing, but a **cockpit for agentic coding**.

## Problems it solves

| Problem               | Answer                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------ |
| RAM usage and crashes | No indexing, Rust backend, lazy loading.                                                   |
| Switching projects    | All projects in one sidebar, one click or shortcut away.                                   |
| Agent status          | A dashboard shows which agent is working, waiting, done or crashed, plus OS notifications. |
| Seeing the code       | File tree, editor and a live diff of agent changes next to the terminal.                   |
| Scripts               | `package.json` and `composer.json` scripts as buttons.                                     |

## Principles

- **Performance first.** Target: < 150 MB RAM idle with three open projects,
  cold start < 1 s. Measure instead of guessing — benchmarks run in CI from
  M3 on. On Linux, WebKitGTK alone needs more, so the budget there is
  450 MB PSS (maintainer decision, ADR 0022).
- **No indexing.** The file tree loads directories only when they are
  expanded, search runs on demand, `.gitignore` is respected.
- **Agent-agnostic.** An agent is just a command in a PTY. Agent-specific
  extras are optional adapters.
- **English.** Code, comments, commits, docs, issues and UI are in English.
- **i18n from day one.** No UI string is hard-coded; everything goes through
  keys in `locales/en.json`. More languages are just new JSON files.
- **Platforms:** macOS, Linux and Windows; on Windows also as a portable
  `.exe` without installation.
- **Open source:** dual-licensed under MIT OR Apache-2.0.

## Scope

- No IDE features before 0.1. Anything that smells like indexing comes after
  the release and only as an opt-in.
- Optional LSP support may come later, enabled per project only.

## Risks and notes

- **Linux web view.** Tauri uses WebKitGTK on Linux, which is partly slower
  than the web views on macOS and Windows. Test on Linux early and keep a
  canvas fallback for xterm.js if WebGL misbehaves.
- **Windows PTY.** ConPTY behaves differently for some CLIs. Test the target
  agents on Windows early.
- **Portable Windows build.** The `.exe` needs the WebView2 runtime, which is
  normally present on Windows 10/11. If it is missing, show a clear error.
- **Code signing.** Unsigned builds trigger Gatekeeper (macOS) and
  SmartScreen (Windows) warnings. macOS notarization requires an Apple
  Developer account; until then the README explains the warning.
- **Status heuristics** will never be perfect. Thresholds are configurable
  per profile and adapters take precedence over heuristics.
- **Scope creep.** Stay a cockpit, not an IDE.
