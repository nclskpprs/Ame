# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project foundation: licenses (MIT OR Apache-2.0), contribution guidelines,
  code of conduct, security policy, issue and PR templates.
- Agent rules (`AGENTS.md`) and project documentation in `docs/`, including
  architecture decision records.
- Desktop app scaffold with Tauri 2, Svelte 5 and TypeScript.
- Settings stored as JSON in the OS config directory, with a portable mode:
  place a `portable` file next to the executable to keep all data in a
  `data` folder next to it.
- Ame Dark and Ame Light themes; the theme follows the system by default
  and can be switched in the sidebar.
- English UI texts with an i18n system ready for more languages.
- Continuous integration on macOS, Linux and Windows.
- Open several projects at once; pin them and sort them into groups from
  the context menu. Switch with Ctrl/Cmd+1…9. Open tabs, expanded folders
  and panel sizes are restored after a restart.
- File tree that loads folders on demand, respects `.gitignore` and
  follows changes on disk.
- Code editor (CodeMirror 6) with tabs, syntax highlighting for JS/TS,
  JSON, CSS/SCSS/Sass, HTML, XML, Markdown, PHP, Python, Rust, Go, Java,
  Kotlin, C#, C/C++, SQL, YAML, TOML, shell, PowerShell, Dockerfile, Ruby,
  Lua, Swift, INI/properties and diffs (each loaded only when needed), and
  JetBrains Mono. Files changed by agents reload automatically; unsaved
  edits are never overwritten silently.
- Quick open (Ctrl/Cmd+P), search in project (Ctrl/Cmd+Shift+F) and a
  command palette (Ctrl/Cmd+K).
- Settings view (Ctrl/Cmd+, or the gear in the sidebar) for theme,
  density and rain effects.
- Files open from the file tree with a double click; a single click
  selects. Single-click opening can be enabled in the settings.
- Unsaved files are marked in the file tree (also on collapsed folders
  that contain them) and in the window title, in addition to the tab.
- Closing a project or the app with unsaved files asks inline (save all,
  discard, cancel) instead of losing them. Files are only ever saved
  manually; "Save All Files" (Ctrl/Cmd+Alt+S) saves every open file of the
  project.
- Terminal panel below the editor (Ctrl/Cmd+J) with several shell sessions
  per project (Ctrl/Cmd+Shift+T, Ctrl/Cmd+Alt+Left/Right). Sessions keep
  running in the background; their output is replayed when they are shown
  again. GPU rendering where available, colors from the theme, links open
  in the browser, copy and paste with Ctrl+Shift+C/V on Linux and Windows.
  While a terminal has focus, Ctrl shortcuts such as Ctrl+K or Ctrl+P go to
  the program in it.
- Agent profiles for Claude Code, Codex CLI, Gemini CLI, OpenCode, Aider
  and the shell. Installed agents are detected on the PATH (also the one
  from your shell profile when Ame was started from a desktop launcher).
  Start an agent with Ctrl/Cmd+Shift+A or from the terminal panel;
  exited sessions can be restarted or continue their last conversation.
- Quitting the app or closing a project with running terminal sessions
  asks inline first, since the sessions would be stopped.
- Sessions that were open when Ame was closed come back as tabs after a
  restart: continue the agent's last conversation with one click (e.g.
  `claude --continue`), start it again or dismiss it.
