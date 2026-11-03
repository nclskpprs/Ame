# Releasing

How a version of Ame gets built and published. The workflow is
`.github/workflows/release.yml`.

## Steps

1. On `main`, set the new version in **both** places:
   - `Cargo.toml` → `[workspace.package] version`
   - `package.json` → `version`

   Use plain `MAJOR.MINOR.PATCH` versions. Pre-release suffixes break a
   bundle: the Windows `.msi` (WiX) accepts only a numeric one, and the
   Linux `.rpm` rejects any `-` (`0.1.0-1` failed). A test build is simply
   a draft release that is not published.

2. In `CHANGELOG.md`, rename _Unreleased_ to the version and date and add a
   new empty _Unreleased_ section.
3. Commit (`chore(release): 0.1.0`), then tag and push:

   ```sh
   git tag v0.1.0
   git push origin main v0.1.0
   ```

4. The **Release** workflow checks that the tag matches both versions
   (`scripts/check-version.mjs`), builds on all three platforms and attaches
   everything to a **draft** release:

   | Platform | Files                                                               |
   | -------- | ------------------------------------------------------------------- |
   | macOS    | `.dmg` and `.app.tar.gz` (universal: Apple silicon + Intel)         |
   | Linux    | `.AppImage`, `.deb`, `.rpm` (built on Ubuntu 22.04)                 |
   | Windows  | NSIS installer `.exe`, `.msi`, and `Ame_<version>_x64_portable.zip` |
   | Updater  | `.sig` signatures and `latest.json`                                 |

5. Check the draft (download and start at least one build per platform),
   then publish it on GitHub. Only versions with a `-` are marked as
   pre-release: the in-app updater reads `latest.json` from the **latest
   full release** (`releases/latest/download/latest.json`), so 0.x
   versions must be full releases, and a draft is invisible to it until it
   is published.

To rebuild an existing tag, run the workflow by hand
(_Actions → Release → Run workflow_) with the tag name.

## Preview builds

To test the current state without a version, run the **Preview** workflow
(`.github/workflows/preview.yml`) by hand, usually on `main`:

```sh
gh workflow run preview.yml --ref main
```

It replaces the pre-release **Ame Preview** (tag `preview`) with fresh
builds for macOS (universal `.dmg`), Linux and Windows, built from the
selected branch. The version inside stays whatever `main` has (`0.0.0`
between releases). The preview is never marked as the latest release, so
it does not interfere with real releases or, later, in-app updates. There
is no portable Windows ZIP in the preview.

## Portable Windows build

The portable ZIP contains `Ame.exe` and a file named `portable`. While that
file is next to the executable, Ame keeps its settings, workspace and web
view data in a `data` folder beside it (ADR 0011). Delete the file to use
the normal config directory.

## In-app updates

Ame checks the endpoint on start and every six hours (setting _Updates_),
shows a notice in the sidebar and installs with "Install and restart"
(ADR 0026). The artifacts are signed with the updater key: the private key
and its password are the repository secrets `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (key file `~/.tauri/ame.key` on the
maintainer's Linux machine); the public key is `plugins.updater.pubkey` in
`tauri.conf.json`. **Losing the private key means installed versions can
no longer be updated** — keep a backup. Without the secrets, the release
and preview workflows fail, because `createUpdaterArtifacts` needs them.

The portable Windows build, Linux `.deb`/`.rpm` installs and debug builds
cannot replace themselves; they get a link to the release page instead.

A local `pnpm tauri build` with bundles needs the key too
(`TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/ame.key)` and the password).
Without it, build with `--no-bundle` or turn the updater artifacts off for
that build: `pnpm tauri build -c '{"bundle":{"createUpdaterArtifacts":false}}'`.

## Not yet

- **Code signing:** macOS builds are only ad-hoc signed
  (`bundle.macOS.signingIdentity: "-"`), not with a Developer ID and not
  notarized. On first start macOS blocks the app: allow it under _System
  Settings → Privacy & Security → Open Anyway_, or run
  `xattr -dr com.apple.quarantine /Applications/Ame.app`. Windows builds
  are unsigned and show a SmartScreen warning (_More info → Run anyway_).
