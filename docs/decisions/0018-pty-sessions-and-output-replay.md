# 0018. PTY sessions: raw output replay and throttled channels

- **Status:** Accepted (settles the open buffer choice of
  [0006](0006-terminal-stack.md))
- **Date:** 2026-10-31

## Context

ADR 0006 left open whether the backend keeps a parsed terminal state per
session (`alacritty_terminal` or `vt100`) or only the raw output. Hidden
sessions must keep running without an xterm.js instance, and their output
must look right when a terminal view is opened again. The RAM target is
below 150 MB with three projects open, and many sessions run at once.

## Decision

- Each session keeps the **last 1 MiB of raw output** in a byte ring buffer
  (`pty/ring.rs`). When a view attaches, the buffer is replayed into a fresh
  xterm.js instance, which re-parses it. After the buffer wrapped, the
  replay starts after the first line break so it does not begin in the
  middle of an escape sequence.
- No full terminal emulator runs in the backend. A tiny parser
  (`pty/modes.rs`) only tracks DEC private modes the backend needs; for now
  bracketed paste, so text sent to an agent can be wrapped in paste
  brackets. M3 may add a light `vt100` screen (without scrollback) for
  status patterns if the raw tail is not enough.
- Per session three threads: a **reader** (blocking PTY reads), a **pump**
  that batches output (the first chunk after a quiet period goes out at
  once, later ones are collected for 16 ms, at most 256 KiB per batch) and
  a **waiter** for the exit status. Output reaches the frontend through a
  Tauri `Channel<String>` per attached view; text is decoded incrementally
  so characters split across reads stay intact.
- Attaching sends the replay and registers the channel under one lock, so no
  live output is lost or duplicated. A token makes stale detaches harmless.
- The frontend sends one write at a time and buffers keystrokes meanwhile,
  so input order is kept even though commands run concurrently.
- On macOS and Linux the environment of the user's login shell is captured
  once in the background (`$SHELL -l -i -c env`, 5 s timeout) and merged
  into every session, so agents installed via npm, Homebrew or nvm are found
  when the app was started from a desktop launcher.

## Consequences

- Memory per session is bounded (~1 MiB plus thread stacks), independent of
  how long an agent runs.
- Replays of full-screen programs are only as good as the retained output:
  if the buffer wrapped, the top of the screen may look wrong until the
  program redraws (it does so after the resize sent on attach).
- Output produced at another terminal size replays at the current size.
- `kill` sends SIGHUP on Unix (portable-pty); a program that ignores it
  keeps running until the app quits.
- Sessions still end with the app. Surviving a UI crash needs the separate
  daemon process planned in M2.
