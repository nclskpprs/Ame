# Ame — Agent Manager Editor

> **Ame** (雨) is Japanese for _rain_. Every drop is a signal.

Ame is a lean, cross-platform desktop app for **agentic coding**. It keeps
many projects open at once and runs any terminal coding agent per project —
Claude Code, Codex CLI, Gemini CLI, Aider, OpenCode or a plain shell — and
shows at a glance which agent is working, waiting for you, done or crashed.

Ame is **not** an IDE replacement. There is no indexing and no language
server by default. It is a cockpit: terminals, agent status, a file tree,
a lightweight editor and a live diff of what your agents changed.

> **Status:** pre-alpha. Projects, file tree, editor and search work (M1);
> terminals and agents are next (M2). There is nothing to install yet. See
> the [roadmap](docs/ROADMAP.md).

## Why

- **Low memory, no crashes.** A Rust backend, no indexing, lazy loading
  everywhere. Target: under 150 MB RAM idle with three projects open and a
  cold start under one second.
- **Switch projects instantly.** All open projects live in one sidebar,
  one click or `Ctrl/Cmd+1…9` away.
- **Know what your agents are doing.** A dashboard and status dots show
  whether each agent is _working_, _needs input_, _idle_, _exited_ or in
  _error_, plus a system notification when it needs you.
- **See the code.** File tree, editor and a live diff of agent changes next
  to the terminal.
- **Run scripts.** `package.json` and `composer.json` scripts as one-click
  tasks.

## Screenshots

Screenshots will be added with the first release (0.1).

## Installation

There are no releases yet. Release 0.1 will ship:

| Platform | Format                          |
| -------- | ------------------------------- |
| macOS    | `.dmg` (universal)              |
| Linux    | AppImage, `.deb`                |
| Windows  | Installer and a portable `.exe` |

Early builds will not be code-signed. macOS Gatekeeper and Windows
SmartScreen will warn you before the first launch. The Windows build needs
the WebView2 runtime, which is preinstalled on Windows 10 and 11.

### Portable mode (Windows)

Place an empty file named `portable` (or `portable.txt`) next to `ame.exe`.
Ame then stores its settings and web view data in a `data` folder next to
the executable instead of your user profile, so you can run it from a USB
stick without installing anything.

## Building from source

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 24 or newer and [pnpm](https://pnpm.io/)
- The Tauri 2 system dependencies for your platform, see
  [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
  On Debian/Ubuntu:

  ```sh
  sudo apt-get install build-essential pkg-config curl wget file \
    libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
    libayatana-appindicator3-dev librsvg2-dev
  ```

### Run

```sh
pnpm install
pnpm tauri dev     # start the app in development mode
pnpm tauri build   # build a release bundle for your platform
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for all checks, conventions and the
project layout.

## Documentation

- [Roadmap](docs/ROADMAP.md)
- [Vision and principles](docs/VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design and UX](docs/DESIGN.md)
- [Architecture decision records](docs/decisions/)
- [Changelog](CHANGELOG.md)

## Contributing

Contributions are welcome — bug reports, agent profiles for new CLIs,
translations and code. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and
our [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see
[SECURITY.md](SECURITY.md).

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or
  <https://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or
  <https://opensource.org/licenses/MIT>)

at your option.

Unless you explicitly state otherwise, any contribution intentionally
submitted for inclusion in the work by you, as defined in the Apache-2.0
license, shall be dual licensed as above, without any additional terms or
conditions.
