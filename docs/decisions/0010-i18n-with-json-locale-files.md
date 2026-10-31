# 0010. i18n with JSON locale files and a tiny helper

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

The UI is English, but more languages (German first) will follow. Strings
must therefore never be hard-coded. Existing libraries either do not use
Svelte 5 runes, are unmaintained, or require a compiler step.

## Decision

- One JSON file per locale in `locales/`; `en.json` is the source of truth.
- A small `t(key, params)` helper in `src/lib/i18n/` with keys typed from
  `en.json`, `{name}` placeholders and fallback to English. The active
  locale is reactive state; other locales are loaded lazily.
- Tests ensure that every locale has the same keys as `en.json` and that no
  Svelte component contains raw text or literal user-visible attributes.

## Consequences

- No runtime dependency; typos in keys are type errors.
- Plural rules and number/date formatting are not covered yet; add
  `Intl.PluralRules` support when the first plural string appears.
