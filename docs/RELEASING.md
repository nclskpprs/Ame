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

5. Check the draft (download and start at least one build per platform),
   then publish it on GitHub. Versions `0.x` are marked as pre-release.

To rebuild an existing tag, run the workflow by hand
(_Actions → Release → Run workflow_) with the tag name.

## Portable Windows build

The portable ZIP contains `Ame.exe` and a file named `portable`. While that
file is next to the executable, Ame keeps its settings, workspace and web
view data in a `data` folder beside it (ADR 0011). Delete the file to use
the normal config directory.

## Not yet

- **Code signing:** macOS builds are only ad-hoc signed
  (`bundle.macOS.signingIdentity: "-"`), not with a Developer ID and not
  notarized. On first start macOS blocks the app: allow it under _System
  Settings → Privacy & Security → Open Anyway_, or run
  `xattr -dr com.apple.quarantine /Applications/Ame.app`. Windows builds
  are unsigned and show a SmartScreen warning (_More info → Run anyway_).
- **In-app updates:** need the updater signing key. The maintainer creates
  it with `pnpm tauri signer generate -w ~/.tauri/ame.key`, stores the
  private key and its password as the repository secrets
  `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, and
  hands over the public key (`~/.tauri/ame.key.pub`) for
  `tauri.conf.json`. Then the workflow also produces signed updater
  artifacts and `latest.json`.
