# Security Policy

## Supported versions

Ame is pre-release software. Until 1.0, only the latest release receives
security fixes.

| Version        | Supported |
| -------------- | --------- |
| latest release | yes       |
| older releases | no        |

## Reporting a vulnerability

**Please do not report security vulnerabilities in public issues.**

Report them privately through GitHub:
[Report a vulnerability](https://github.com/nclskpprs/Agent-Editor/security/advisories/new).

Please include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- the affected version and platform.

You can expect a first response within 7 days. We will keep you informed
about the fix and credit you in the release notes unless you prefer to stay
anonymous.

## Scope

Ame runs terminal programs and coding agents with your user permissions and
reads and writes files in the projects you open. Areas that are especially
relevant:

- the local endpoint used by agent adapters (Unix socket / named pipe),
- the IPC boundary between the web view and the Rust backend,
- handling of untrusted project files (e.g. `.ame.json`, `package.json`),
- the update mechanism.
