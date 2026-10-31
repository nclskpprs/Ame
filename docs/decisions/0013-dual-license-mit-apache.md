# 0013. Dual license MIT OR Apache-2.0

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Ame is open source and built on the Rust ecosystem, where dual licensing is
the norm.

## Decision

License Ame under **MIT OR Apache-2.0**, at the user's option. Both license
texts are in the repository root. Contributions are accepted under the same
terms.

## Consequences

- Maximum compatibility with Rust crates and other open-source projects.
- Apache-2.0 provides an explicit patent grant; MIT keeps it simple.
- Bundled third-party assets with other licenses (e.g. JetBrains Mono, OFL)
  must ship their license texts.
