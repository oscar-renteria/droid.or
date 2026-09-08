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
npm run build:linux   # + electron-builder --linux
npm run build:win     # + electron-builder --win
npm run build:mac     # + electron-builder --mac
```

Only the Linux target (`AppImage`) is currently configured with real
packaging settings in `electron-builder.yml`; `build:win`/`build:mac` exist
as scripts but haven't been exercised or configured with code
signing/notarization. See `ADB.md` for platform-specific ADB/USB
considerations independent of packaging.
