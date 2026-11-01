# 0022. Self-measuring benchmarks

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

`docs/VISION.md` sets two hard targets: less than 150 MB RAM idle with
three projects open, and a cold start under one second. M3 asks for these
numbers in CI, so regressions show up in the pull request that causes them.
Measuring a desktop app from the outside is fragile: "started" is hard to
detect, and the web view runs in separate processes.

## Decision

- The app **measures itself**. The frontend calls `app_ready` after the
  first painted frame; the backend knows the process start time
  (`bench::mark_start`, first thing in `main`) and logs the startup time on
  every start.
- With `AME_BENCH=<file>`, the app waits 5 s to settle, sums the memory of
  its process tree (the web view processes are children on Linux and
  Windows; threads are not processes), writes
  `{ startupMs, memoryMb, memoryKind, processes, os }` as JSON and quits.
  On Linux the memory is the proportional set size (PSS from
  `/proc/<pid>/smaps_rollup`), so shared libraries count once across the
  tree; elsewhere it is the resident set size. In this mode the single-instance plugin is off, so benchmarks also
  run while Ame is open.
- `scripts/bench.mjs` prepares a config dir with three small projects, runs
  the release binary several times, reports the medians (job summary in
  GitHub Actions) and fails above the budget.
- CI: a `bench` job on `ubuntu-24.04` builds the release binary and runs
  the script under `xvfb-run`. It only reports (`--no-fail`) until the
  memory budget is settled (see below).

## Alternatives considered

- **Measuring from outside** (process start until a window appears, `ps`
  for memory): does not see when the UI is usable, and the window manager
  is part of the measurement.
- **A test framework (WebDriver, tauri-driver):** heavy, and its driver
  changes the numbers.
- **Benchmarks on all three platforms:** macOS runs the web view in XPC
  services outside the process tree, and hosted runners vary a lot; Linux
  first, others later.

## Consequences

- First numbers (release build, WSLg, software rendering): startup
  about 830 ms; memory about 380 MB PSS — `ame` 108 MB (mostly GTK and
  WebKit libraries), `WebKitWebProcess` 250 MB, `WebKitNetworkProcess`
  22 MB. Without accelerated compositing
  (`WEBKIT_DISABLE_COMPOSITING_MODE=1`) the web process drops to about
  120 MB (total about 250 MB). The 150 MB target of `docs/VISION.md` is not
  reachable with WebKitGTK as is; the maintainer decides between a
  per-platform budget and further savings.
- CI runners are slower than developer machines and use software
  rendering; a failing startup budget there may need a runner-specific
  budget. The first numbers decide.
