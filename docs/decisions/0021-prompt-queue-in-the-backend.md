# 0021. Prompt queue in the backend

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

M3 plans a prompt queue per agent: follow-up prompts that are sent
automatically as soon as the agent is idle. Agents keep running while the
window is hidden (ADR 0020), and that is exactly when a queue is most
useful. Sending at the wrong moment is harmful: text typed into a question
prompt, into a half-written prompt of the user, or two prompts glued
together.

## Decision

- The queue lives in the **Rust backend**, per session
  (`agents/queue.rs`, `PromptQueue` in `pty::Session`). It is part of
  `SessionInfo` (`queue`), so every change reaches the frontend with
  `sessions-changed`.
- The **status loop** of the PTY manager (every 250 ms) asks each running
  session for a due prompt. A prompt is due when
  - the agent state is `idle` (never `needsInput`, `working`, `starting`
    or after the exit),
  - the user typed nothing for 4 s (they may be writing a prompt by hand),
  - the previous queued prompt was picked up: the agent was seen in another
    state since it was sent, or 30 s passed without any reaction.
- Sending runs on a short-lived thread (writes may block): the text goes in
  as a paste (bracketed when the program asked for it), then Enter after
  150 ms.
- Commands: `queue_prompt`, `remove_queued_prompt`, `move_queued_prompt`,
  `clear_prompt_queue`. Limits: 64 KiB per prompt, 50 prompts per session.
- Frontend: a composer and list above the terminal (`PromptQueue.svelte`),
  shown only while the composer is open or prompts wait; command
  "Queue Prompt for Agent" (`Mod+Alt+Enter`, works from a focused
  terminal); the count on dashboard cards.

## Alternatives considered

- **Queue in the frontend:** simpler to build, but the web view of a
  hidden window may be throttled, and the timing would depend on the
  `sessions-changed` round trip.
- **Send on the transition to idle only:** misses an agent that is already
  idle when a prompt is queued, and needs extra state anyway.

## Consequences

- Without an adapter, "idle" comes from the heuristics (quiet output);
  an agent that pauses longer than its `idleAfterMs` while thinking could
  get the next prompt early. With the Claude Code hooks adapter, idle means
  the turn really ended.
- Programs that answer instantly and briefly (their reply looks like the
  echo of the input) make the next prompt wait for the 30 s fallback.
  Conversely, a program that stays silent for more than 30 s after a
  prompt (e.g. `sleep 100` in a shell) gets the next one while it is still
  busy. Agents print while they work, so this mainly affects shells.
- The queue of a session is lost when the app quits or the session is
  closed; it is not persisted.
