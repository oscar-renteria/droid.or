# Development

## Prerequisites

- Node.js 22 (the version CI uses is pinned in `.nvmrc`; `nvm use` picks it up) and npm
- No Android device is required for most development — see
  [Developing without a device](#developing-without-a-device) below

## Setup

```bash
npm install
```

## Running the app

```bash
npm run dev
```

Runs `electron-vite dev`: a Vite dev server for the renderer with hot
module reload, plus the Electron main/preload processes rebuilt on change.
This talks to a **real** `adb` — either one already on your system `PATH`,
or one droid.or downloads itself the first time you use the Settings page's
"Download platform-tools" option.

```bash
npm run preview
```

Builds once (`electron-vite build`) and launches the packaged output — use
this to check what a production build actually behaves like, or to verify
a change without hot reload interfering.

Electron enforces a single-instance lock (`app.requestSingleInstanceLock`),
so launching a second `dev`/`preview` while one is already running just
focuses the existing window rather than opening a second one — quit the
running instance first if you need a genuinely fresh process.

## Type-checking

```bash
npm run typecheck
```

Runs three separate checks, each against its own `tsconfig`:

- `typecheck:node` — the main + preload processes
- `typecheck:web` — the Vue renderer (`vue-tsc`)
- `typecheck:test` — the test suite

`npm run build` runs the full `typecheck` before bundling, so a type error
never silently makes it into a build.

## Linting & formatting

```bash
npm run lint           # eslint .
npm run format          # prettier --write .
npm run format:check    # prettier --check .
```

## Testing

```bash
npm run test        # vitest run — single pass
npm run test:watch  # vitest — watch mode
```

Tests live under `tests/`, mirroring the `src/` layout they exercise
(`tests/main/adb/...` tests `src/main/adb/...`, and so on). See
`ARCHITECTURE.md` for how the suite avoids needing a physical device.

When adding a test that touches `AdbClient`, use the existing
`FakeAdbClient` (`tests/fakes/fake-adb-client.ts`) rather than mocking
`child_process` directly — it already implements the full interface and is
what the rest of the suite depends on for consistency.

## Developing without a device

Every automated test runs against `FakeAdbClient`, so the full suite works
with nothing plugged in. Running the app itself with `npm run dev` /
`npm run preview`, however, always uses the real `AdbClient` — there is
currently no in-app mock-device mode for manual UI testing. Manually
exercising a feature end-to-end still requires a real, USB-connected
Android device with debugging enabled.

## Verifying real device behavior

`pm`/`dumpsys` output has genuinely differed between Android versions and
OEMs during this project's development — for example, `pm list packages -d`
silently omits a disabled package entirely on some Android 10 devices
without an additional `-u` flag, something that went unnoticed until a
second physical device was tested (see `ANDROID_COMPATIBILITY.md`). Before
adding or changing anything that parses `adb shell` output, prefer running
the exact command against a real connected device (`adb shell <command>`)
over assuming documented behavior — and note in a comment what was actually
verified versus what's inferred from documentation, the way the rest of the
codebase does.

## Project structure

See `ARCHITECTURE.md` for the full breakdown. In short:

```text
src/
├── main/       # Electron main process — ADB, persistence, IPC handlers
├── preload/    # The only bridge between main and renderer
├── renderer/   # Vue 3 app (stores, views, components)
└── shared/     # Types, Zod schemas, and constants used by more than one
                # of the above
tests/          # Mirrors src/
```

## Building & packaging

```bash
npm run build         # type-check + bundle (out/)
npm run build:linux   # + electron-builder --linux  (x64 AppImage)
npm run build:win     # + electron-builder --win    (x64 NSIS installer + portable .exe)
npm run build:mac     # + electron-builder --mac    (arm64 dmg)
```

All three platforms have real settings configured in `electron-builder.yml`
(installer behavior, categories, entitlements). **Only the Linux target has
actually been built and run from this project's own (Linux) dev
environment** — the other two are built by CI instead (see below), not
locally, for reasons specific to this dev machine rather than the config.
electron-builder publishing is disabled in config; release publication is
handled separately by the workflow.
Package builds generate `THIRD_PARTY_NOTICES.txt` from installed production
dependencies, bundle it alongside the app's `LICENSE`, and expose it from
the About dialog.

- **Windows**: native modules aren't actually the blocker they first
  appear to be — `better-sqlite3` ships prebuilt binaries for every
  platform (`node_modules/better-sqlite3/prebuilds/`), so `@electron/rebuild`
  doesn't need to compile anything from source, and a genuine
  `droid.or.exe` (verified: a real PE32+ Windows binary) was produced from
  this Linux machine. What actually blocks a _complete_ Windows build here
  is Wine, which electron-builder needs on non-Windows hosts to embed the
  icon/version resources into the `.exe` — not installed on this project's
  dev machine, and not worth installing just for this when CI already
  builds on a real Windows runner anyway.
- **macOS**: electron-builder can only produce a macOS build (`.app`,
  `dmg`) on macOS itself — a hard restriction of electron-builder,
  unrelated to the native-module point above.

## CI and releases

Three workflows live in `.github/workflows/`:

- **`ci.yml`** runs on every pull request and every push to `master`:
  actionlint (which also runs shellcheck on `run:` scripts), type-checking
  and lint on Ubuntu, and the test suite on Ubuntu and Windows. `master` is
  protected by a repository ruleset: these four checks must pass, and
  force-pushes and deletion are blocked, so changes reach `master` through
  pull requests.
- **`build.yml`** packages all three platforms, each on its own native
  GitHub-hosted runner (`ubuntu-latest`, `windows-latest`, `macos-latest`),
  so the local limitations above don't apply: no Wine, no
  cross-compilation. It doesn't run on push; start it from Actions → Build →
  Run workflow for a snapshot build, or let `release.yml` call it.
- **`release.yml`** runs when a `v*.*.*` tag is pushed. It checks that the
  tag is a SemVer version equal to `package.json`'s, reruns the quality gate
  (including `format:check`), builds through `build.yml`, then creates a
  **draft** GitHub release with the binaries, `SHA256SUMS.txt` and a build
  provenance attestation for every file. The release procedure is in
  [`RELEASING.md`](RELEASING.md).

What `build.yml` checks on each platform:

- **Linux**: the deterministic x64 AppImage name; that `app.asar` contains
  only the app output, package metadata and production dependencies (no
  tests or source maps); and the generated third-party notices.
- **Windows**: the x64 NSIS and portable `.exe` names and their product,
  version, copyright, company and trademark metadata.
- **macOS**: the arm64 DMG and the app's ad-hoc signature (`codesign`). This
  job may fail without failing the workflow, because macOS is experimental.
- **Every platform** launches the packaged app with `--smoke-test` (AppImage
  under Xvfb; the Windows portable and the silently installed NSIS app; the
  macOS app from the mounted DMG). It opens the SQLite database, waits for
  the renderer and preload to load, and exits non-zero on any failure.

The artifacts are uploaded to the run's Actions page. Dependabot
(`.github/dependabot.yml`) proposes weekly grouped updates for npm packages
and for the pinned GitHub Actions.

### Code signing and notarization

No Developer ID or Authenticode certificate is configured. Windows
installers remain unsigned and trigger a SmartScreen warning. The macOS
arm64 app is ad-hoc signed (`identity: '-'`) so its code signature can be
verified, but an ad-hoc signature is not trusted by Gatekeeper and the app
is not notarized. The macOS CI job verifies the signature; neither
packaging format nor an ad-hoc signature removes the first-run warning.
If real signing credentials become available:

- **Windows**: a code-signing certificate (a paid Authenticode certificate
  from a CA). electron-builder picks it up automatically from the
  `CSC_LINK` (path or base64-encoded `.pfx`) and `CSC_KEY_PASSWORD`
  environment variables — no config change needed.
- **macOS**: a "Developer ID Application" certificate from a paid Apple
  Developer Program membership, for signing (`CSC_LINK`/`CSC_KEY_PASSWORD`
  again), **plus** notarization credentials for Gatekeeper to trust the
  signed build — electron-builder notarizes automatically (via
  `@electron/notarize`, already an installed dependency) once
  `hardenedRuntime: true` is set (already is) and either
  `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`, or an App
  Store Connect API key (`APPLE_API_KEY` + `APPLE_API_KEY_ID` +
  `APPLE_API_ISSUER`), are set as environment variables. With none of
  these set, electron-builder just logs a warning and skips signing/
  notarization — it does not fail the build.

To actually turn this on in CI: add the relevant values above as encrypted
repository secrets (Settings → Secrets and variables → Actions on GitHub),
then map each one to an environment variable on the `build` step in
`.github/workflows/build.yml` (e.g. `CSC_LINK: ${{ secrets.CSC_LINK }}`) —
the workflow file doesn't reference any of them today, matching the
decision to ship unsigned for now.

### App icon

The icon is one 1024×1024 source image, `build/icon.png`, referenced once
as `icon:` in `electron-builder.yml`. electron-builder derives the Windows
`.ico` and macOS `.icns` from it during the build on each platform.

See `ADB.md` for platform-specific ADB/USB considerations independent of
packaging.
