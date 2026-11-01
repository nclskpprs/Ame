# 0019. Agent hooks via the app binary and a loopback endpoint

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

The status heuristics (output activity, CPU, bells, patterns) cannot tell
for sure when an agent is done or asks a question: an agent that redraws
its prompt looks busy, a bell after a finished task looks like a question.
Claude Code has hooks (`SessionStart`, `UserPromptSubmit`, `Notification`,
`Stop`, …) that run a command with the event as JSON on stdin. The
architecture planned "a bundled helper CLI" that the hooks call and "a
small local endpoint (Unix socket, named pipe on Windows)" in the app.

Open questions were how the hooks get into Claude Code without touching
the user's files, what the helper is, and what the endpoint is.

## Decision

- **Injection:** Ame writes `<config dir>/adapters/claude-settings.json`
  with its hooks on start and starts Claude Code with
  `--settings <file>`. Claude Code merges hooks from all settings sources,
  so the user's own hooks keep running, and no project or user file is
  changed. Profiles opt in with `adapter: "claude-hooks"` (the built-in
  Claude Code profile has it; an empty string turns it off).
- **Helper:** the Ame executable itself with a subcommand,
  `ame hook claude`. `main.rs` checks the arguments before Tauri starts,
  so the helper is fast (about 20 ms on Linux in a debug build). It reads
  stdin, sends the event name, a detail (notification type, start source)
  and the message to the endpoint, prints nothing (stdout of some hooks
  goes into the conversation) and always exits with 0 (exit code 2 would
  block the prompt).
- **Endpoint:** a TCP listener on `127.0.0.1` with a random port, and a
  random 128-bit token. Sessions of profiles with an adapter get
  `AME_HOOK` (address) and `AME_HOOK_TOKEN`; `AME_SESSION_ID` names the
  session. One connection carries one JSON line with a protocol version;
  lines with the wrong token or version are dropped.
- **Precedence:** an adapter's last signal wins (`Stop` → idle,
  `UserPromptSubmit`/`PreCompact` → working, a permission or elicitation
  `Notification` → needs input), except that the process exit always
  counts and that an agent the adapter still thinks of as working turns
  idle once the heuristics see it quiet (an interrupt sends no hook).
  Answering a question (input while the adapter says "needs input") means
  working again. Hooks that fire for every tool call are not registered,
  since each hook starts a process.

## Alternatives considered

- **A separate helper binary** (a second workspace crate shipped as a Tauri
  sidecar): an extra build step per target triple and something that can
  get out of sync with the app, for no gain; the app binary already has
  everything the helper needs.
- **Unix socket and Windows named pipe:** two code paths, and the Windows
  one cannot be tested here; a named pipe's default ACL also needs care.
  Loopback TCP with a token works the same on all three systems.
- **Claude Code `http` hooks:** no process per hook, but only in newer
  Claude Code versions and Claude-specific; the command helper also fits
  other agents' notify commands (e.g. Codex `notify`).
- **Writing hooks into `.claude/settings.local.json` of the project:**
  changes the user's project, and stays behind when Ame is gone.

## Consequences

- Precise states for Claude Code without any setup; other agents keep the
  heuristics until they get an adapter (the helper takes the agent name).
- Any local process of the same user can read a session's environment and
  could fake a state; that is the same trust level as the session itself.
- On Windows Claude Code runs hooks with Git Bash; the command uses a
  quoted path with forward slashes. Without Git Bash (PowerShell) the hook
  would fail silently and the heuristics remain. Not tested on Windows and
  macOS yet.
- The settings file contains the path of the running executable. An
  AppImage's path is only valid while it runs, which is fine because
  sessions end with the app.
