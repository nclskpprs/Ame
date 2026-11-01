# Design and UX: the rain concept

**Ame — Agent Manager Editor.** Ame (雨) is Japanese for _rain_, and that is
what carries the design: calm, bluish, with rain as a sparse accent that
transports information.

> **Every drop is a signal.** Rain shows activity and is never mere
> decoration.

## Rain as status

| State            | Rain metaphor              | Presentation                                                                           |
| ---------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `working`        | It is raining              | Fine falling drops in the status indicator; density follows the output rate (tokens/s) |
| `needs_input`    | A drop hangs on the window | A resting, gently pulsing drop in amber                                                |
| `idle` / done    | Puddle with a ripple       | A single ripple animation, then still                                                  |
| `exited`/`error` | Thunderstorm, subtle       | A red drop without animation noise                                                     |
| Prompt sent      | A drop falls               | A drop falls from the input into the agent panel                                       |

### Where rain appears

- Status dots in the sidebar and the dashboard (the core).
- Dashboard header: a narrow "sky" in which every sent prompt falls as a
  drop — shows at a glance how much is happening across all projects.
- Empty states and the app icon: a drop that is also a text cursor.
- Optionally a quiet drop sound on `needs_input` (off by default).
- Implementation: the density of the working rain follows the output rate
  (`intensity` 1–3 from the backend, bytes per second without echo); every
  submitted prompt (`prompts` counter) lets one drop fall into the status
  dot and one drop fall in the dashboard sky, which ends in a ripple. The
  sky is one canvas that only animates while drops fall.

### Origami (paper)

Ame's companion motif is folded paper, a nod to the paper ninja of the
hidden rain village. Paper stands for what is _prepared but not yet
falling_:

- **Queued prompts** use a paper crane icon: a folded prompt that waits and
  becomes a drop once it is sent.
- **Easter egg:** typing `konan`, `amegakure`, `origami` or `紙` in the
  command palette reveals "Dance of the Paper", a short swirl of folded
  paper over the window (the same canvas rules as the rain; nothing happens
  while rain effects are off).
- Paper never appears as decoration beyond these two places.
- **Not in the editor and not in the terminal** — there, only the code
  matters.

### Animation performance rules

- A single canvas or CSS transforms only — no DOM element per drop.
- Paused when the window is hidden or unfocused, max 30 fps, budget below
  1 % CPU.
- `prefers-reduced-motion` is respected; setting _Rain effects: on / subtle /
  off_.

## Color tokens

Starting values; they are fine-tuned in the UX review. Contrast must meet at
least WCAG AA. Source of truth in code: `src/lib/theme/tokens.ts`.

| Token            | CSS variable        | Ame Dark              | Ame Light        |
| ---------------- | ------------------- | --------------------- | ---------------- |
| bg               | `--ame-bg`          | `#0E1621` (night sky) | `#F5F8FB` (mist) |
| surface          | `--ame-surface`     | `#152131`             | `#FFFFFF`        |
| border           | `--ame-border`      | `#22324A`             | `#DCE4EE`        |
| text             | `--ame-text`        | `#D8E2EE`             | `#1A2433`        |
| text-muted       | `--ame-text-muted`  | `#8597AD`             | `#5B6B80`        |
| accent / working | `--ame-accent`      | `#5AA9FF`             | `#2F74D0`        |
| needs-input      | `--ame-needs-input` | `#F2B84B`             | `#B47A0E`        |
| done             | `--ame-done`        | `#4FD1B5`             | `#1E9E82`        |
| error            | `--ame-error`       | `#F06A6A`             | `#D14343`        |

Accent and status colors are meant for indicators (dots, drops, borders,
focus rings), where WCAG AA requires 3:1 against adjacent colors. In the
light theme, `accent` (4.35:1 on `bg`), `error` (4.29:1), `needs-input`
(3.44:1) and `done` (3.14:1) are below the 4.5:1 required for body text, so
they must not be used for small text. The light `needs-input` was darkened
from the plan's `#C98A12` (2.76:1) to `#B47A0E` to reach 3:1. The contrast
test in `src/lib/theme/contrast.test.ts` guards all of this.

### Theming

- The theme follows the system (light/dark) by default and can be switched
  manually (`system` / `dark` / `light`).
- The CodeMirror syntax theme and the terminal colors are derived from the
  same tokens (blue and teal tones).
- UI font: the system font (SF Pro, Segoe UI, Cantarell/Ubuntu) — feels
  native and costs nothing.
- Code font: bundled JetBrains Mono (OFL license), configurable.

## UX principles

- **Calm over noise:** no toolbars full of icons; features via the command
  palette and context menus.
- **Status without searching:** sidebar, dashboard, window title and
  dock/taskbar badge.
- **Keyboard first:** every action has a shortcut; all are findable in the
  palette.
- **No modal dialogs for routine work:** inline confirmation and undo instead
  of "Are you sure?".
- **Instant response:** interactions under 50 ms, no splash screen, spinner
  only after 300 ms.
- **Onboarding in three steps:** open a folder, choose an agent, go.
  Installed agents on the `PATH` are detected automatically.
- **Progressive disclosure:** git, script and resource panels only appear
  when the project needs them.
- **Selectable density:** comfortable / compact.
- **Accessibility:** full keyboard operation, visible focus, screen reader
  labels.

## Roadmap mapping

- Design tokens, both themes and the base layout: M0/M1.
- Rain status animations and the prompt drop: M3.
- Icon and branding: done in M6 — `branding/icon.svg` (night-sky square,
  accent drop outline, a light text cursor inside, two faint drops of
  rain); the platform icons are generated with
  `pnpm tauri icon branding/icon.svg`.
- Before 0.1: a UX review with screenshots of every view in light and dark.
