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
- Send code to an agent: select lines in the editor and press
  Ctrl/Cmd+Shift+Enter. The agent receives `path:lines` and the code as a
  paste (it is not submitted), ready for your prompt.
- File type icons in the file tree and the editor tabs (a curated set from
  Material Icon Theme, MIT); can be hidden in the settings.
- Agents in the settings: see which agents were found and where, change
  the command line of a built-in agent (and reset it), or add your own.
- Agent status: every session shows whether its agent is working, waits
  for your input, is done or exited, as a rain-style dot in the terminal
  tabs and next to the project in the sidebar. The window title counts the
  agents that wait for you. Detection works for any program (output
  activity, CPU use, bells and terminal notifications, the exit code) plus
  question patterns per agent profile.
- Dashboard (Ctrl/Cmd+Shift+D or in the sidebar): every agent of every
  project as a card with its status, running time and last output line,
  agents that wait for you first. A click jumps to the session.
- OS notifications when an agent you are not looking at needs your input,
  finishes a longer task or fails (can be turned off in the settings or
  muted per project in its context menu), and the number of waiting agents
  on the dock/taskbar icon.
- Closing the window while agents run keeps Ame running in the
  background: a tray icon lists the agents and their state, and starting
  Ame again brings the window back. Ctrl/Cmd+Q quits and ends all agents,
  including programs they started in the background (a dev server, a
  watcher). Can be changed in the settings ("Closing the window").
- Resource use: the sidebar shows the memory of each project's running
  agents and programs (CPU and memory in the tooltip), the dashboard
  shows both per session.
- Precise status for Claude Code: Ame starts it with its own hooks (your
  hooks and project settings stay untouched), so "done" and "waits for
  you" are reported by Claude Code itself, with its permission message.
  Other agents keep the generic detection.
- Git: changed, new, deleted and conflicted files are colored in the file
  tree with a status letter, and folders show the changes inside them. The
  status follows saves, file changes, window focus and working agents.
- Changes panel (Ctrl/Cmd+Shift+G, only in git repositories): branch,
  ahead/behind and the staged and unstaged files. Opening a file from there
  shows its changes against the last commit inline in the editor, with
  Keep and Revert for every change (Ctrl/Cmd+Alt+D toggles the inline diff
  for any file).
- Stage and unstage files (one by one or all) and commit from the changes
  panel; Ctrl/Cmd+Enter in the message commits. Git hooks run as usual.
- Files an agent just changed are marked in the file tree for a minute.
  Follow mode (Ctrl/Cmd+Alt+F) opens the file an agent changed last as an
  inline diff, without taking the focus from the terminal.
- Prompt queue: queue follow-up prompts for an agent (Ctrl/Cmd+Alt+Enter or
  the queue button in the terminal bar); they are sent one by one as soon
  as the agent is done, also while the window is hidden. Reorder or remove
  waiting prompts above the terminal; the dashboard shows the count.
- Rain status: the rain in a working agent's status dot gets denser the
  more it prints, each sent prompt drops into its dot, errors show as a red
  drop, and the dashboard header has a narrow sky where every prompt falls.
- Origami: queued prompts carry a paper crane, and the command palette
  hides a small paper easter egg for fans of the hidden rain village.
- Checkpoints: before every prompt to an agent, Ame saves the project's
  files in a hidden git ref. The changes panel lists them with the files
  changed since; restore with one click (and undo the restore). Can be
  turned off in the settings.
- Scripts: `package.json` (npm, pnpm, yarn or bun, from the lock file) and
  `composer.json` scripts appear in a scripts panel and in the command
  palette; each runs in its own terminal tab with a status.
- Project groups for agents: start an agent in one project with access to
  the other projects of its group (Claude Code, Codex, Gemini CLI), send
  one prompt to the agents of all projects in a group, and see the
  dashboard grouped by project group.
- App icon: a rain drop that is also a text cursor.
- Branches: see the local branches and switch between them from the
  changes panel or the command palette.
- Ready-made prompt: ask an agent (or the agents of a project group) to
  clean up the git branches and return to `develop` or the main branch.
- Prompt library: save your own prompts (in the settings or straight from
  the queue), with `{project}`, `{branch}` and `{main}` placeholders, and
  send them with Ctrl/Cmd+Alt+P to the project's agent or to every agent of
  its group.
- Start an agent with each project: choose your preferred agent in the
  settings, and it starts as soon as a project without terminal sessions is
  opened.
- Terminal: Shift+Enter inserts a line break in agent prompts instead of
  submitting them.
- Zoom the whole app with Cmd/Ctrl+Plus and Cmd/Ctrl+Minus; Cmd/Ctrl+0
  resets it. The zoom is remembered.
- Start a shell or an agent with the mouse: while the terminal panel is
  hidden, a slim bar below the editor shows it again or starts a shell or
  an agent; the panel itself got a "New shell" button.
- File tree: show files excluded by `.gitignore` (e.g. `.env`,
  `node_modules`), dimmed, with a setting or the "Show or Hide Ignored
  Files" command.
- File tree: create files and folders, rename or move them (also by drag
  and drop) and move them to the trash, from the context menu, the command
  palette or with F2 and Delete (Cmd+Backspace on macOS). Deleting asks
  inline first; open tabs follow moved files.
- Unread agent results: when an agent finishes, asks something or fails
  while you look elsewhere, its terminal tab, dashboard card and project
  stay marked (bold with a dot) until you open that terminal, even hours
  later. Mark a result as unread again from the context menu, and jump to
  the next unread one with Cmd/Ctrl+Shift+U.
- Reveal in Finder / Explorer / file manager and Copy Path for files,
  folders and projects, from the context menus of the file tree and the
  sidebar and from the command palette; files also offer Copy Relative
  Path.
- Project groups are framed in the sidebar, and projects move between
  groups, out of a group, onto the pinned list or off it by drag and drop.
- Board (Cmd/Ctrl+Shift+B): prepare work packages per project — a title
  plus fields like ticket and description — and send each to an agent you
  pick, running or newly started, when you are ready. Packages move from
  Open to Started to Done. Templates with your own fields and prompt are
  set up in the settings. Packages stay on your machine.

### Changed

- Script runs no longer count as unread results; only agents and shells
  do.

### Fixed

- Terminal panel: it stays on the terminal you used last. Closing a
  terminal goes back to the one used before, and the shown terminal is
  remembered across restarts, instead of jumping to the newest one.
- The file tree and the changes panel follow every change on disk without
  a reload: on macOS and Windows the whole project is watched (ignored
  folders such as `node_modules` excepted), and commits, checkouts and
  staging are noticed on every platform. Projects opened through a
  symlinked path get change events again on macOS.
- Release builds: the editor shows line numbers beside the code and
  syntax highlighting again; the content security policy blocked the
  editor's styles.
- Terminal panel: no dark strip below the last line anymore.
- Windows: sessions started in the background (no visible terminal) no
  longer hang before the program starts.
- The side panel tabs stay on one line with four tabs, settings with long
  descriptions keep their switch on the right, and arrow keys show as
  arrows in shortcuts.

- The resource monitor counted every thread of an agent as a process, so
  memory and CPU of multi-threaded agents were shown far too high.

- The file tree now notices new and changed files in the project folder
  itself when no subfolder is expanded, and the file watcher no longer
  reacts to its own reads (on Linux this caused a constant reload loop).
