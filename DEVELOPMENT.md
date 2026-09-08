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
npm run build:win     # + electron-builder --win    (NSIS installer)
npm run build:mac     # + electron-builder --mac    (dmg + zip)
```

All three platforms have real settings configured in `electron-builder.yml`
(installer behavior, categories, entitlements) — but **only the Linux
target has actually been built and run** from this project's own (Linux)
dev environment. The other two have real, hard platform constraints, not
just "untested":

- **Windows**: `npm run build:win` currently **fails** even on Linux CI,
  for a reason unrelated to the electron-builder config itself —
  `better-sqlite3` is a native module that `@electron/rebuild` recompiles
  against Electron's own ABI for the target platform, and `node-gyp`
  cannot cross-compile a native module for Windows from Linux. Building a
  real Windows installer requires running `build:win` on Windows itself
  (or a Windows CI runner) — there is no config change that fixes this
  from Linux.
- **macOS**: electron-builder can only produce a macOS build (`.app`,
  `dmg`, `zip`) on macOS itself — this is a hard restriction of
  electron-builder, independent of the native-module issue above. Building
  a real macOS release requires an actual Mac (or macOS CI runner).

### Code signing and notarization

Nothing above produces a _signed_ build — an unsigned Windows installer
triggers a Windows SmartScreen warning, and an unsigned/unnotarized macOS
app is blocked outright by Gatekeeper. Neither can be fixed by
configuration alone; both require credentials this project does not have:

- **Windows**: a code-signing certificate (a paid Authenticode certificate
  from a CA). Once you have one, electron-builder picks it up
  automatically from the `CSC_LINK` (path or base64-encoded `.pfx`) and
  `CSC_KEY_PASSWORD` environment variables — no config change needed.
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
