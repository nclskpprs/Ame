# 0006. Terminal stack: xterm.js, portable-pty and a backend buffer

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Agents run in pseudo terminals. Many sessions run at the same time, most of
them in the background. Keeping an xterm.js instance per session would cost
memory and CPU.

## Decision

- **xterm.js** with the **WebGL addon** renders visible terminals (canvas
  fallback where WebGL misbehaves, e.g. on some WebKitGTK setups).
- **portable-pty** (from WezTerm) spawns PTYs on all platforms, including
  ConPTY on Windows.
- The backend keeps a **ring buffer and terminal state per session** using
  `alacritty_terminal` or `vt100`; the concrete crate is chosen in M2 after a
  short spike. Hidden sessions have no xterm.js instance; their output is
  replayed when they are shown.

## Consequences

- Background sessions are cheap; status detection can read the last screen
  lines in Rust.
- Terminal state exists twice for visible sessions (backend and xterm.js).
- ConPTY differences must be tested early with the target agents.
