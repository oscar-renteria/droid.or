# Development

## Prerequisites

- Node.js (a current LTS release) and npm
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
npm run build:linux   # + electron-builder --linux  (AppImage)
npm run build:win     # + electron-builder --win    (NSIS installer + portable .exe)
npm run build:mac     # + electron-builder --mac    (dmg + zip)
```

All three platforms have real settings configured in `electron-builder.yml`
(installer behavior, categories, entitlements). **Only the Linux target has
actually been built and run from this project's own (Linux) dev
environment** — the other two are built by CI instead (see below), not
locally, for reasons specific to this dev machine rather than the config:

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
  `dmg`, `zip`) on macOS itself — a hard restriction of electron-builder,
  unrelated to the native-module point above.

### CI builds (`.github/workflows/build.yml`)

Every push to `master` builds all three platforms on their own native
GitHub-hosted runner (`ubuntu-latest`/`windows-latest`/`macos-latest`), so
neither limitation above applies there — each OS uses its own prebuilt
native binary and its own real toolchain, no Wine or cross-compilation
involved. Artifacts (the AppImage, the NSIS installer + portable `.exe`,
the dmg + zip) are uploaded as workflow artifacts, downloadable from that
run's Actions page. Can also be triggered manually (`workflow_dispatch`)
without a push. This requires the repository to actually be on GitHub with
Actions enabled — pushing to a purely local `master` does nothing.

### Code signing and notarization

Every artifact this project produces — locally or via CI — is deliberately
**unsigned**. That's an accepted trade-off, not an oversight: an unsigned
Windows installer/portable `.exe` triggers a Windows SmartScreen warning
("Run anyway" bypasses it), and an unsigned/unnotarized macOS app is
blocked by Gatekeeper (right-click → Open bypasses it) — packaging format
doesn't change either of those, only real signing credentials do, and this
project doesn't have any. If that changes:

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

No custom icon exists yet (nothing under `build/`) — every target
currently falls back to electron-builder's own default Electron icon
(confirmed via a real build: `default Electron icon is used` in the log,
not a failure). Add one real, high-resolution source image at
`build/icon.png` (at least 1024×1024) and reference it as
`icon: build/icon.png` under each platform section in
`electron-builder.yml` — electron-builder derives the platform-specific
`.ico`/`.icns` from that single file itself.

See `ADB.md` for platform-specific ADB/USB considerations independent of
packaging.
