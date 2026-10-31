# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Ame is developed largely by coding agents across many sessions. Without a
written record, the reasons behind decisions get lost and are re-litigated.

## Decision

Significant decisions are recorded as short ADRs in `docs/decisions/`,
numbered `NNNN-short-title.md`, using the format of
[0000-template.md](0000-template.md). ADRs are not rewritten; a new ADR
supersedes an old one.

## Consequences

- Agents read the ADRs instead of guessing the intent.
- Every architecture change needs a few minutes of writing.
