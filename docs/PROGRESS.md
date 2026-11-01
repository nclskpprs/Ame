# Progress Log

Newest entry first. Every agent session adds an entry: what was done, what
is open, what comes next.

## Current state

- **Milestones:** M0–M5b are complete (extras skipped for now: review mode
  in M4, dev server detection and `.ame.json` in M5). M6 — Release 0.1:
  icon, UX review, release workflow and README are done; **in-app updates**
  are open.
- **Branches:** PR #2 (M1–M6) is merged into `main`. Work goes on short
  branches from `main` (`feat/…`, `fix/…`, `chore/…`), one Conventional
  Commit per task, never directly on `main`.
- **Test release `v0.1.0-1`:** draft release with the macOS `.dmg` and the
  Windows builds (Linux failed: `.rpm` rejects the `-`, so use plain
  versions from now on). The maintainer tests it on a Mac; the feedback
  comes as a German summary from a local checklist. The tag stays on its
  own commit; `main` keeps version `0.0.0` until the 0.1.0 release.
- **Acceptance:** the per-feature acceptance test is paused; the
  maintainer reviews everything at the end. The M1 checklists for file
  tree, editor, search and palette are still unreviewed (local `abnahme/`
  folder, not in git).
- **Preview builds:** `gh workflow run preview.yml --ref main` replaces
  the pre-release "Ame Preview" (tag `preview`) with fresh builds for
  all three platforms; the maintainer tests from there.
- **Signing:** ad-hoc on macOS is enough for now (maintainer decision);
  no Apple Developer ID, Windows stays unsigned.
- **CI:** green on macOS, Linux and Windows. The benchmark runs under
  `dbus-run-session`; startup in CI is ~920 ms against a 1 s budget.
- **Development machines:** Linux (WSL) so far, macOS from now on. Locally
  only the own platform is checked; Windows-only (`cfg(windows)`) code is
  first compiled in CI, so watch the Windows job after such changes.
  Read CI logs with `gh run view` / `gh api …/actions/jobs/<id>/logs`
  (logs need a login even though the repo is public).

## Next steps

1. **Act on the macOS test feedback** from the maintainer.
2. **M6: in-app updates.** Done by the maintainer: signing key
   (`~/.tauri/ame.key` on the Linux machine, key ID `66F7B297F3DF034F`) and
   the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Public key for
   `plugins.updater.pubkey`:
   `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDY2RjdCMjk3RjNERjAzNEYKUldSUEE5L3psN0wzWmhvVzZNZEZWSHkzMlBnRTdXS2ttd2Q5eDl1QXlaNUxKTzRzSkw5YW1yTWoK`.
   Plan:
   - Add `tauri-plugin-updater` (Cargo.toml, `lib.rs`); specta-typed
     commands for check and install in a new backend module, registered
     in `ipc::builder()`.
   - `tauri.conf.json`: `bundle.createUpdaterArtifacts: true`;
     `plugins.updater` with the public key and the endpoint
     `https://github.com/nclskpprs/Ame/releases/latest/download/latest.json`.
   - `release.yml`: pass both signing secrets to the `tauri-action` step
     so it signs the artifacts and uploads `latest.json`.
   - Frontend: a setting to check on start and periodically, a "Check for
     Updates" command, an inline notice and an OS notification, and
     "Install and restart". The portable Windows build
     (`AppPaths::is_portable()`) gets a download link instead.
   - Then: ADR, `docs/ARCHITECTURE.md`, `docs/RELEASING.md` ("Not yet"),
     ROADMAP, PROGRESS and CHANGELOG.
3. **Release 0.1.0** with a plain version (see `docs/RELEASING.md`), then
   the first publication.

## Log

### 2026-11-01 — Preview workflow

**Done**

- `.github/workflows/preview.yml`: started by hand on a branch, it deletes
  the previous "Ame Preview" pre-release and its `preview` tag, creates
  a new one on the current commit (never marked latest) and lets
  `tauri-action` upload the macOS universal, Linux and Windows builds to
  it via `releaseId`. No version check, no portable ZIP. Documented in
  `docs/RELEASING.md`.

**Open**

- `fs::watcher::tests::reports_writes_but_not_reads` is flaky on macOS CI
  (FSEvents can report the write made just before `watch()` late); it
  failed once on PR #5 and passed on the re-run.

### 2026-11-01 — macOS smoke test of a release build; editor styles fixed

**Done**

- Release build of `main` driven on macOS (fake agent, AppleScript keys,
  window screenshots): start, file tree, command palette, go to file,
  project search, agent terminal and session restore work. Benchmark:
  303 ms to first frame, 111 MB idle with three projects (the `ame`
  process only, without the WebKit helper processes).
- Fixed: in release builds the editor rendered unstyled (line numbers
  above the code, no highlighting). The inline `<style>` in `index.html`
  made Tauri add a hash to the CSP `style-src`, which disables
  `'unsafe-inline'` and blocks the styles CodeMirror injects. The boot
  background moved to `public/boot.css`; a test keeps `index.html` free of
  inline styles. `pnpm tauri dev` has no CSP, so this only showed in
  release builds — check the editor in a release build after CSP changes.

- Fixed: a dark strip below the terminal. `xterm.css` paints
  `.xterm-viewport` black and xterm 6 only colors the rows it draws;
  the viewport now uses `--ame-bg` (the terminal theme background).

**Open**

- A tiny lighter square (~12 px) in the bottom-right corner of the
  terminal, probably the scrollbar corner. Cosmetic.

### 2026-11-01 — Test release 0.1.0-1 for macOS testing

**Done**

- PR #2 (M1–M6) merged into `main` by the maintainer. The single-branch
  process ends; work continues on short branches from `main`.
- Version `0.1.0-1` and tag `v0.1.0-1`: the first run of the release
  workflow, so the maintainer can test the universal `.dmg` on a Mac. A
  numeric pre-release because the Windows `.msi` (WiX) rejects `-rc.1`.
- Release run 41334053874: macOS (universal `.dmg`) and Windows built and
  are attached to the draft; Linux failed because `.rpm` rejects the `-`
  in `0.1.0-1`. Rule added to `docs/RELEASING.md`: plain versions only.
- macOS builds are ad-hoc signed (`signingIdentity: "-"`), so Gatekeeper
  offers "Open Anyway" instead of calling the app damaged.
- The release branch is merged into `main` for its docs and the ad-hoc
  signing setting; the version goes back to `0.0.0` there, since
  `0.1.0-1` was only for the test tag.

**Decided**

- Signing (maintainer, 2026-11-01): ad-hoc signing on macOS is enough for
  now; an Apple Developer ID and notarization are not needed while the app
  can be opened on macOS. Windows signing (e.g. SignPath for open source)
  stays optional.

### 2026-11-01 — CI: Windows, macOS and the benchmark

**Done**

- Windows: the test binary crashed with `STATUS_ENTRYPOINT_NOT_FOUND`.
  Tauri embeds the Common Controls v6 manifest only into the app binary,
  so `build.rs` now embeds `src-tauri/windows-app-manifest.xml` through the
  linker for every binary, tests included. This was red since M0.
- With the tests running on Windows for the first time, a real bug showed:
  portable-pty creates ConPTY with `PSEUDOCONSOLE_INHERIT_CURSOR`, so
  ConPTY asks for the cursor position (`ESC[6n`) before it starts the
  program. Without an attached view nobody answered and hidden sessions
  never ran. The backend now answers cursor position requests while no
  view is attached and drops them from the scrollback.
- Checkpoint tests disable `core.autocrlf` (Git for Windows checks out
  CRLF).
- macOS: `closing_ends_what_the_program_started` used `/proc` and the
  `setsid` command, which macOS lacks. It now uses `ps` and Perl's
  `POSIX::setsid`.
- Benchmark: startup was ~31 s on the runner. A diagnostic CI run showed
  that the runner's systemd session bus stalls portal requests until the
  D-Bus timeout; with `dbus-run-session` startup was 916 ms. The bench now
  runs with a private session bus. Locally (WSLg) startup is 0.4–1.5 s.

**Open**

- Startup in CI (916 ms) is close to the 1 s budget; watch for flakes.

### 2026-11-01 — Push, and starting the preferred agent per project

**Done**

- Pushed `feat/m1-project-shell` (44 commits, pre-push `pnpm verify`
  green). `gh` is not installed here, so the maintainer opens the draft PR
  (CI only runs for pull requests and `main`).
- Maintainer request: setting "Start an agent with each project" (off by
  default, a list of installed agents). `TerminalGroup.autoStart` starts it
  once per project and app run when the project has no sessions and none
  to resume.
- Answered: the Claude Code profile's command stays `claude`; "Claude
  Code" is only its name.

**Verified**

- Unit tests (starts once; not again after closing; not with previous
  sessions or without a preference). In `pnpm tauri dev` with a demo agent
  as preference: it started in `web` at launch and in `api` on switching;
  the setting shows the chosen agent.
- `pnpm verify` green.

### 2026-11-01 — Prompt library

**Done** (maintainer request)

- `settings.prompts` (`LibraryPrompt`), placeholders `{project}`,
  `{branch}`, `{main}`; "Send Prompt…" (`Mod+Alt+P`) with each prompt for
  the project's agent and for the project group; settings section "Prompt
  library" (add, edit, delete with inline confirmation; Cancel takes the
  focus so a double Enter never deletes); "Save to library" in the queue
  composer. The built-in "clean up branches" is part of the library.

**Verified**

- Unit tests (placeholders, ordering, unnamed prompts, ids, picker items
  with and without a group, target agent).
- In `pnpm tauri dev`: the picker lists the built-in and a user prompt,
  each for the agent and for the group; sending filled in `develop` and
  `ux-demo`; the settings list shows both, delete asks inline and saves.
  The add form was not driven in the GUI (keyboard focus got lost in the
  test tool); it follows the agent profile form.
- `pnpm verify` green.

### 2026-11-01 — Branches and the "clean up branches" prompt

**Done** (maintainer request)

- `git_branches` / `git_switch`, branch picker from the changes panel's
  branch name and "Switch Branch…".
- Prompt library `lib/agents/prompts.ts` with "clean up branches": safe
  steps (`fetch --prune`, `branch -d` only, protected main branches, ask
  before unmerged work, `pull --ff-only`). Commands for the project's agent
  and for the project group; sent through the prompt queue.

**Verified**

- Rust tests (listing, switching, refusing options and unknown branches,
  main branch choice), frontend tests (prompt, target agent).
- In `pnpm tauri dev`: the picker lists four branches with ages and marks
  `main` as current; switching to `develop` kept the uncommitted changes;
  the clean-up prompt reached the demo agent and named `develop`. The
  same run showed a checkpoint created before that prompt (first GUI
  check of checkpoints).
- `pnpm verify` green.

**Open**

- Creating and deleting branches from the UI is not planned (agents or
  the terminal do that); say if wanted.

### 2026-11-01 — M6: UX review in light, README screenshots

**Done**

- Light theme: search, quick open, inline diff, scripts panel, dashboard
  reviewed. Fix: the diff's Keep/Revert buttons sat on the editor's right
  edge (moved in by 8 px).
- `docs/screenshots/` (project view dark and light, dashboard with a
  project group; a "Demo Agent" profile prints a scripted run, no real
  agent output is shown). README updated: status, features (queue,
  checkpoints, groups), screenshots, release formats.

**Open**

- Settings and the agent picker in the light theme were not captured
  separately (seen during earlier work).

### 2026-11-01 — M6: UX review, first pass

**Done**

- Dark theme screenshots (WSLg) of the project view with a git repository,
  the changes panel, a terminal, the dashboard with a project group, the
  settings and the command palette.
- Fixes: side panel tabs wrapped the change count and cut off "Scripts"
  (now one line, tighter spacing, horizontal scroll as a fallback);
  settings rows with long descriptions pushed the switch below the text;
  shortcuts show `↑↓←→` instead of `ArrowDown`.

**Open**

- Light theme, search, quick open, inline diff and the editor's merge
  view still to review; screenshots for the README (M6 "Docs").

### 2026-11-01 — M6: release workflow

**Done**

- `.github/workflows/release.yml`: on a `v*` tag (or by hand), checks the
  tag against `Cargo.toml` and `package.json`
  (`scripts/check-version.mjs`), builds with `tauri-action` on macOS
  (universal), Ubuntu 22.04 and Windows into a draft release, and attaches
  a portable Windows ZIP (`Ame.exe` + `portable` marker).
- `docs/RELEASING.md` (steps, artifacts, portable build, what is missing).

**Verified**

- `check-version.mjs` with matching, mismatching and invalid tags; both
  workflow files parse as YAML. The workflow itself has not run (needs a
  push of a tag).

**Open — needs the maintainer**

- Updater signing key (see `docs/RELEASING.md`), then in-app updates.
- First push and a test tag (e.g. `v0.0.1`) to see the workflow run.

### 2026-11-01 — M6: app icon

**Done**

- `branding/icon.svg` and the generated desktop icons in `src-tauri/icons`
  (mobile icons removed). Checked at 256 and 32 px.

**Open**

- The tray icon is still drawn by the frontend (badge); unchanged.

### 2026-11-01 — M5b: project groups for agents

**Done**

- Profile field `addDirArg` (built-in for Claude Code, Codex, Gemini CLI;
  editable in the agent settings), `start_session` with `dirs`, sessions
  and saved sessions keep their folders.
- "Start Agent for Project Group…", "Send Prompt to Project Group…" (via
  the prompt queue), dashboard grouped by project group.
- Maintainer: dev server detection and `.ame.json` (M5 extras) wait.

**Verified**

- Unit tests (folder options, group folders, eligible agents, broadcast
  targets, card blocks). `pnpm verify` green.
- In `pnpm tauri dev` with two projects in a group and a fake agent
  profile (prints its arguments, echoes input): the group agent starts
  with `--add-dir <other project>` and is titled "Fake Agent (+1)"; the
  broadcast reached both agents; the dashboard shows the "client" block.
- Claude Code is installed on the dev machine: picking it in the group
  picker started it with `--add-dir` (its trust prompt appeared); it was
  cancelled at once, nothing was sent.

**Open**

- Whether Codex and OpenCode accept `--add-dir` in the installed versions
  is unchecked (OpenCode has no folder option yet).

### 2026-11-01 — M5: script detection and runner

**Done**

- Maintainer: extras (review mode) come after everything runs; review
  mode is skipped for now. Checkpoints were almost done and got finished.
- `scripts/` backend: detection of `package.json` / `composer.json`
  scripts at the root, package manager from lock file / `packageManager`,
  `list_scripts`, `run_script` (a PTY session with profile `script:<id>`).
- Frontend: scripts side panel (progressive disclosure) with status of the
  last run, run / stop; palette entries "Run script: …"; command
  "Show Scripts"; script sessions are not restored after a restart.

**Verified**

- Unit tests (detection, lock files, composer hooks, broken manifests,
  manifest changes, running a script once and showing it while it runs).
- In `pnpm tauri dev` on WSLg: the Scripts tab appears with a
  `package.json`; "Run script: hello" runs `npm run hello` (exit 0, gray),
  `fail` ends with code 3 (red in the panel, tab, sidebar).
- `pnpm verify` green.

**Open**

- Windows: npm/pnpm are `.cmd` files; starting them directly in ConPTY is
  untested (the same applies to npm-installed agents).

### 2026-11-01 — M4: checkpoints before every prompt

**Done**

- `git/checkpoints.rs` (ADR 0023): hidden refs via a temporary index;
  dedupe, 50 per project, skip above 2000 untracked files; restore with an
  undo checkpoint; only the project folder inside a larger repository.
- `PtyManager::on_prompt` → checkpoint per prompt of agent sessions (not
  the shell), setting `checkpoints` (default on), event
  `checkpoints-changed`.
- Changes panel: list with age, files changed since, inline confirmation,
  "Files restored · Undo"; command "Create Checkpoint".

**Verified**

- Rust tests in temporary repositories: HEAD, index, status and files
  untouched by a checkpoint; dedupe; restore of changed, added and deleted
  files with ignored files left alone; undo; before the first commit;
  bound of 50; unknown ids rejected. A PTY test for the prompt listener.
- `pnpm verify` green.
- Not tried in the GUI (maintainer asked to keep moving; checkpoints were
  almost done when they were deprioritized). Check in the final review:
  run an agent, let it change files, restore and undo from the changes
  panel.

**Open**

- Review mode (M4) is next only if wanted; the maintainer prefers getting
  everything running first.

### 2026-11-01 — M3: memory budget per platform

**Done**

- Maintainer decision: budgets per platform plus turning off accelerated
  compositing on Linux. The budget part is in: Linux 450 MB PSS, otherwise
  150 MB, startup < 1 s; the CI job now fails above it.
- Turning off compositing was built and measured (294 MB with the WebKit
  setting, about 250 MB with the environment variable), then **reverted**:
  without compositing, xterm's WebGL canvas showed new terminal output
  only on the next input event (compared side by side with the same key
  sequence on WSLg). Recorded in ADR 0022.

**Open**

- First CI run on a hosted runner (needs a push): check the Linux numbers
  and adjust the 450 MB budget if needed.
- Maybe later: xterm's DOM renderer without compositing, measured again.

### 2026-11-01 — M3: benchmarks for startup time and memory

**Done**

- `bench.rs` (ADR 0022): the app measures itself. The frontend reports its
  first frame (`app_ready`, replaces the old frontend-only startup log);
  the backend logs "ready after N ms" from the process start. With
  `AME_BENCH=<file>` it measures its process tree after 5 s (PSS on
  Linux), writes JSON and quits; single instance is off in that mode.
- `scripts/bench.mjs`: three projects, several runs, medians, job summary,
  budget check (`--no-fail` to only report).
- CI job `bench` (ubuntu-24.04, release build, `xvfb-run`), report only.
- Fix: `pty/tree.rs` counted threads as processes on Linux (sysinfo lists
  them), so the resource monitor showed far too much memory and CPU for
  multi-threaded agents, and the first benchmark said 33 GB.

**Verified**

- Unit tests: PSS parsing, JSON shape, own-tree measurement, threads not
  in the tree. `pnpm verify` green.
- Release build on WSLg: startup 822–833 ms (budget 1 s ✓), memory
  382 MB PSS (budget 150 MB ✗): `ame` 108, `WebKitWebProcess` 248,
  `WebKitNetworkProcess` 22. With `WEBKIT_DISABLE_COMPOSITING_MODE=1` the
  web process needs about 120 MB (total about 250 MB).

**Open — needs the maintainer**

- The 150 MB target is not reachable with WebKitGTK as is. Options: a
  per-platform budget (e.g. Linux 400 MB PSS, measured on real runners),
  turning off accelerated compositing on Linux (saves about 130 MB under
  software rendering; animations and xterm's WebGL need checking), or
  both. Until then the CI job only reports.
- The CI job has not run yet (no push); its first numbers on a hosted
  runner will differ from WSLg.

### 2026-11-01 — M3: rain status animations, prompt drop and origami

**Done**

- Backend: `SessionInfo.prompts` (submitted prompts: input ending in Enter
  outside a bracketed paste, also from the queue) and
  `SessionInfo.intensity` (1–3 from output bytes per second, only while
  working), both refreshed by the status loop.
- `StatusDot`: rain density per intensity, a one-shot drop falling into
  the dot for each new prompt (tabs, dashboard cards, sidebar projects),
  the error state as a static red drop.
- `lib/rain/`: `Sky` particle model, `RainCanvas` (one canvas, ≤ 30 fps,
  runs only while particles exist, stops when the window is inactive or
  rain is off; subtle halves the strength). `RainSky.svelte` in the
  dashboard header: each prompt falls as a drop and ends in a ripple.
- Origami (maintainer idea, a Konan easter egg): paper crane icon
  (`CraneIcon.svelte`) for the prompt queue; secret palette commands
  (`Command.secret`, shown only for an exact word) and "Dance of the
  Paper" for `konan`, `amegakure`, `origami` or `紙`: a swirl of white
  folded paper over the window (`PaperOverlay.svelte`, mounted on first
  use). Described in `docs/DESIGN.md`.
- Fix: the prompt queue composer was clipped in a small terminal panel
  (only the list scrolls now).

**Verified**

- Unit tests: intensity windows, prompt counting, submit detection, sky
  particles (drop → ripple, paper leaves, bound), `newPrompts`, rain mode,
  secret commands, `combinedRain`.
- In `pnpm tauri dev` on WSLg (light theme), driven with XTest: the queue
  sends the first prompt, the second waits; the dashboard sky drop and the
  drops into the status dots are visible; `konan` shows "Dance of the
  Paper" and white origami swirls over the window.
- `pnpm verify` green.

**Open**

- Vite's watcher does not see file changes on `/mnt/c` under WSL, so the
  dev app must be restarted after edits (F5 serves stale modules).
- A short black strip under the terminal while the queue bar appears
  (WebGL resize on WSLg); it was gone a moment later. Check on real
  platforms.
- Dark theme of the paper and the sky not looked at yet.

### 2026-11-01 — M3: prompt queue per agent

**Done**

- `agents/queue.rs` (ADR 0021): a queue per session in the backend, part
  of `SessionInfo.queue`. The status loop sends the next prompt (paste,
  then Enter after 150 ms, on its own thread) when the agent is idle, the
  user did not type for 4 s and the previous prompt was picked up (or 30 s
  passed). Commands `queue_prompt`, `remove_queued_prompt`,
  `move_queued_prompt`, `clear_prompt_queue`; new error kind
  `promptRejected`.
- Frontend: `PromptQueue.svelte` above the terminal (composer: Enter
  queues, Shift+Enter new line, Esc closes; list with move up/down and
  remove, "Clear all"), shown only while composing or prompts wait.
  Command "Queue Prompt for Agent" (`Mod+Alt+Enter`, also from a focused
  terminal) and a queue button in the terminal bar for running sessions;
  "N queued" on dashboard cards.

**Verified**

- Unit tests for the queue rules (idle only, typing pause, picked up,
  30 s fallback, limits, reorder) and the preview; a PTY test where a shell
  receives the first queued prompt by itself and keeps the second queued.
- `pnpm verify` green (131 Rust tests, 408 frontend tests).
- Not tried in the GUI yet (no WSLg run this session) and not with a real
  agent — check in the final review: queue two prompts for Claude Code
  while it works and watch them go out one after the other.

**Open**

- Prompts are not persisted; quitting or closing a session drops them.
- Heuristic agents (no adapter) that pause longer than `idleAfterMs` while
  thinking may get the next prompt early.

### 2026-11-01 — M3: resource monitor

**Done**

- `session_usage` command: CPU and memory of every running session's
  process tree (measured by the status loop every 2 s).
- Frontend: `lib/agents/usage.svelte.ts` polls only while the window is
  visible and a session runs; the sidebar shows the memory per project
  (CPU and memory in the tooltip), the dashboard cards show both.

**Verified**

- Unit tests for summing and formatting; seen in `pnpm tauri dev` on WSLg
  (sidebar "6 MB" for a shell, dashboard "CPU 0 % · RAM 6 MB").
- `pnpm verify` green.

**Open / resume here**

- Next is the prompt queue (M3). Session ended at the maintainer's request
  (shutdown); everything is committed on `feat/m1-project-shell`.
- Manual GUI tests on WSLg: start with `GDK_BACKEND=x11` and
  `AME_CONFIG_DIR=<temp dir>`; a ctypes XTest script (find the window by
  `_NET_WM_NAME`, send keys, `WM_DELETE_WINDOW`, `XGetImage` screenshots)
  works because WSLg has no xdotool. It lived in the session scratchpad and
  must be rewritten if needed.

### 2026-11-01 — M2: keep running in the background

**Done**

- Maintainer decision: instead of a daemon, closing the window hides it
  while agents run; quitting ends them (ADR 0020).
- `background/`: `hide_window`, `show_window`, `quit_app`, `set_tray`
  commands, tray icon with a session menu, single instance, macOS reopen
  and Cmd+Q through the close guard. Setting `closeAction` (settings
  view), one-time hint notification.
- `Mod+Q` "Quit Ame" (also from a focused terminal); the close guard
  quits through the backend.
- `pty/tree.rs`: ending a session also ends everything its program
  started (SIGTERM / terminate via `sysinfo`); the CPU monitor shares the
  tree walk.

**Verified**

- Tests: close decision, tray model, quit flow of the close guard, process
  tree walk, and a PTY test where a `setsid` child of a session ends when
  the session is closed.
- Manually in `pnpm tauri dev` on WSLg (X11, driven with XTest from a
  ctypes script): X with a running shell hides the window and the shell
  keeps running; a second start shows the window and exits; `Ctrl+Q` (also
  with the terminal focused) shows the inline guard and quitting ends the
  app and the shell; X without running sessions closes the app.
- `pnpm verify` green (400 frontend tests, 123 Rust tests).

**Open**

- The tray icon itself could not be seen under WSLg (no tray host); the
  appindicator was created without errors. Check in the final review.
- macOS (dock reopen, Cmd+Q routing) and Windows (tray click, Alt+F4)
  untested.

### 2026-10-31 — M3: Claude Code hooks adapter

**Done**

- `agents/adapters/` (ADR 0019): a loopback TCP endpoint with a random
  token; the hook helper as a subcommand of the app binary
  (`ame hook claude`, run before Tauri starts, silent, always exit 0);
  `claude-settings.json` in the config dir, passed with
  `claude --settings`. Profile field `adapter` (`claude-hooks` for the
  built-in Claude Code profile; edited profiles keep it).
- `StatusTracker` combines adapter signals with the heuristics: the
  adapter wins, the exit always counts, a quiet agent turns idle without a
  `Stop` (interrupts), answering a question means working.

**Verified**

- Unit tests for the endpoint (token, version, garbage), the event mapping,
  the settings file, the helper and the state combination; an integration
  test (`src-tauri/tests/hooks.rs`) runs the real `ame hook claude` from a
  PTY session that keeps printing and sees the session turn to "needs
  input" with Claude's message.
- The helper takes about 20 ms (debug build, Linux) and prints nothing.
- `pnpm verify` green.

**Open**

- Not tried with a real Claude Code session (it would use the
  maintainer's account): worth checking in the final review that
  `claude --settings` loads the hooks (`/hooks` in Claude Code lists them)
  and that the states follow.
- Windows: hooks run with Git Bash; without it (PowerShell) the hook fails
  silently and the heuristics remain. macOS and Windows untested.
- Other agents (Codex `notify`, Gemini CLI hooks) could use the same
  helper; not done yet.

### 2026-10-31 — File icons, agent settings, M3 status and M4 git

**Done** (one commit per task; this entry was written in the next session,
because the session that built the features ended before logging them)

- File type icons from Material Icon Theme (MIT) in the tree and tabs,
  loaded by the browser only when shown; setting `fileIcons`.
- Agent profiles in the settings view: detected paths, edit or reset
  built-in profiles, add custom ones.
- M3: generic status detection (output activity, CPU of the process tree,
  bells, OSC 9/777, exit code) plus `needsInputPatterns` per profile;
  status dots in terminal tabs and the sidebar, the waiting count in the
  window title; dashboard (`Mod+Shift+D`); OS notifications and the
  dock/taskbar badge, mutable per project.
- M4: git status in the file tree, changes panel (`Mod+Shift+G`), inline
  diff with Keep/Revert per chunk, stage/unstage/commit, recently changed
  files and follow mode (`Mod+Alt+F`).
- Fix: the watcher watches the project root and ignores read events (this
  caused a reload loop on Linux).

**Verified**

- On resume: `pnpm verify` green — 101 Rust tests, 393 frontend tests,
  clippy, ESLint, Prettier and svelte-check clean.

**Open**

- No ADRs were written for status detection and the git integration; the
  architecture document describes both (section _Agent status detection_
  and _Git_).
- Not tried by the maintainer yet (acceptance paused), not tested on macOS
  and Windows (badge overlay icon, notifications).

### 2026-10-31 — Editor wishes and M2 (terminals and agents)

**Done** (one commit per task)

- Maintainer wishes: settings view (`Mod+,`, gear in the sidebar); files open
  with a double click (single click is a setting); no autosave (unchanged,
  saving stays manual) plus "Save All Files"; unsaved markers in the tree
  and the window title; an inline guard when closing a project or the app
  with unsaved files; syntax highlighting for many more languages.
- PTY backend (`pty/`, ADR 0018): sessions with a 1 MiB ring buffer,
  throttled output channels, replay on attach, bracketed paste tracking,
  login shell environment capture.
- Terminal panel with xterm.js 6 (WebGL, DOM fallback), several sessions per
  project, background sessions without xterm instances, theme from tokens
  (new ANSI tokens with a contrast test), Ctrl shortcuts reach the program
  while a terminal has focus (commands opt in with `terminal: true`).
- Agent profiles (Claude Code, Codex, Gemini, OpenCode, Aider, Shell) with
  PATH detection and a picker (`Mod+Shift+A`); restart and resume of
  exited sessions; resume of the last run's sessions after a restart;
  "Send Selection to Agent" (`Mod+Shift+Enter`); a quit/close guard for
  running sessions.

**Verified**

- `cargo clippy -D warnings` clean, 73 Rust tests (PTY spawn, output,
  replay, input, stop/close on Unix); `pnpm check` clean, frontend tests
  green.
- Manually in `pnpm tauri dev` on WSLg (driven with XTest, screenshots):
  shell start, typing, colors, replay after hiding, Ctrl+K reaching bash,
  new session shortcut, inline stop confirmation, exit code bar and
  restart, dark theme switch, agent picker (Claude Code detected), session
  environment, quit guard, resume after restart, send to agent (bracketed
  paste in bash).

**Open**

- **Background daemon (M2 💡) is deferred — needs a maintainer decision.**
  Sessions surviving a UI close means a separate process with a local
  socket (Unix socket / Windows named pipe with a restrictive ACL), detached
  process handling on three platforms and a protocol version check; and the
  quit guard would change ("keep agents running?"). It can only be tested on
  Linux here. Proposal: do it after 0.1, or as its own milestone.
- Not tested on macOS and Windows yet (ConPTY, `.cmd` shims of npm agents,
  Cmd shortcuts). Claude Code itself was not started in tests (it would use
  the maintainer's account).
- WebGL under WSLg runs without GPU (DRI3 missing); the DOM renderer
  fallback was not forced in a test.
- File icons: the maintainer asked whether Atom Material Icons may be used.
  They are MIT licensed, but the README credits many icon sources (some
  CC BY from The Noun Project); Material Icon Theme (MIT, based on Apache
  2.0 Material icons) is cleaner and is the proposal.

### 2026-10-31 — M1 acceptance: HTML context menu

**Done**

- The maintainer's acceptance test of the projects feature failed TF05–TF08:
  the native project context menu never appeared on Linux (WSLg, Wayland),
  also after passing an explicit position (`4eec52c`).
- Replaced native context menus with an HTML menu (ADR 0017):
  `src/lib/menu/` (entries, keyboard navigation, placement, open state) and
  `ContextMenu.svelte` (WAI-ARIA menu, submenus, typeahead, focus return).
  `ProjectList.svelte` uses it for pin, groups and close.

**Verified**

- Unit tests for navigation, typeahead, placement and the open state.
- A throwaway DOM test (happy-dom, not committed) mounted `ProjectList`
  with the menu and ran TF05–TF08 by mouse and keyboard, Escape handling
  and outside clicks: all passed.

**Open**

- Maintainer re-runs TF05–TF08 in the app (plus the new keyboard case).
- No automated UI tests yet; a happy-dom setup for component tests would be
  cheap (decision for the maintainer).
- Pin and group are only reachable from the context menu, not as palette
  commands (AGENTS.md asks for commands for every action).

### 2026-10-31 — M1 completed

**Done** (branch `feat/m1-project-shell`, one commit per task)

- Projects: open several folders, pin, group (native context menu, inline
  group name), close; `workspace.json` with per-project layout (tabs,
  expanded folders, side panel tab and width) restored on start.
- File system backend: lazy `read_dir` with ignore rules, `read_file` /
  `write_file`, path safety, `FsWatcher` for visible directories only
  (ADR 0015).
- Layout: side panel (Files / Search) with keyboard-accessible splitter;
  lazy file tree with full keyboard navigation.
- Editor: CodeMirror 6 with tabs, per-tab state, on-demand languages,
  token-based theme (new syntax tokens, WCAG AA), JetBrains Mono bundled
  (OFL in `licenses/`), save/close with inline prompts, reload on disk
  changes, conflict bar.
- Quick open (`Mod+P`, nucleo) and text search (`Mod+Shift+F`, ripgrep
  libraries, streamed, cancellable).
- Command registry, shortcuts and command palette (`Mod+K`) (ADR 0016).
- Debug builds log frontend errors and the startup time to the terminal.

**Verified**

- `cargo clippy -D warnings` clean, 41 Rust tests; `pnpm check` clean,
  144 frontend tests, ESLint/Prettier clean.
- `pnpm tauri dev` on Linux (WSLg) with a restored layout (pinned project,
  group, expanded folders, three tabs): starts without frontend errors,
  frontend mounted after ~1 s in dev mode on the `/mnt/c` checkout.

**Open**

- Not yet tried interactively by the maintainer; no UI tests exist yet.
  Worth a manual pass: context menu, group naming, splitter, tree keyboard
  navigation, editor save/conflict flow, search jump, palette.
- Performance: CodeMirror is part of the startup bundle (~450 kB JS
  uncompressed); lazy-loading the editor would help the cold-start target.
  Measure in M3.
- Changes in collapsed folders are not watched (by design, ADR 0015); M4
  needs another signal for git status.
- Large directories and long result lists are rendered without
  virtualization (see "Later" in the roadmap).

### 2026-10-31 — M0 completed

**Done**

- Open-source files: dual license (MIT OR Apache-2.0), README,
  CONTRIBUTING, Code of Conduct (Contributor Covenant 2.1), SECURITY, issue
  templates (bug, feature, agent profile) and PR template.
- `AGENTS.md` (single source of truth incl. UX principles), `CLAUDE.md`, and
  `docs/` (vision, architecture, design, roadmap, progress, ADRs 0001–0014).
- Scaffold: Cargo workspace (`src-tauri`, crate `ame`), Tauri 2.12, Svelte
  5, Vite 8, TypeScript 6.0, pnpm 12, Node 24.
- Tooling: Prettier, ESLint, svelte-check, Vitest, clippy (`-D warnings`),
  rustfmt, lefthook hooks, `pnpm verify`.
- i18n: `locales/en.json`, typed `t()`, tests for locale keys and against
  raw text in components.
- Settings + portable mode (`src-tauri/src/workspace/`), typed IPC via
  tauri-specta (`src/lib/ipc/bindings.ts`), frontend settings state.
- Design tokens, Ame Dark/Light, theme switcher, base layout with sidebar
  and empty state.
- CI workflow for macOS, Linux and Windows.

**Verified**

- `cargo clippy --workspace --all-targets -- -D warnings`: clean.
- `cargo test --workspace`: 14 tests pass.
- `pnpm lint`, `pnpm check`: clean. `pnpm test`: all tests pass.
- `pnpm build`: 43.5 kB JS (17.2 kB gzip), 3.9 kB CSS.
- `pnpm tauri dev` on Linux (WSLg): the app starts, the config dir resolves
  and switching the theme writes `settings.json`.

**Decisions made with the maintainer**

- The light `needs-input` color was changed from `#C98A12` (2.76:1) to
  `#B47A0E` (3.44:1) to meet WCAG AA for indicators.
- Code of Conduct reports go through GitHub's private reporting form; the
  maintainer enables _Private vulnerability reporting_ in the repository
  settings.

**Open**

- CI has not run yet (nothing pushed). Branch protection for `main` must be
  configured on GitHub by the maintainer.
- Not verified on macOS and Windows yet (CI will cover build and tests;
  portable mode should be tried manually on Windows).
- The production CSP in `tauri.conf.json` is untested until the first
  release build (`devCsp` is disabled for development).
- The GitHub repository is called `Agent-Editor`; crate and binary are
  `ame`.
- Icons are the Tauri defaults until branding (before M6).

**Notes for agents**

- On WSL with the repo under `/mnt/c`, builds are slow; setting
  `CARGO_TARGET_DIR` to a Linux path (e.g. `~/.cache/ame-target`) helps.
