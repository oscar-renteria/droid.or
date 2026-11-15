# Architecture

## Process architecture

droid.or follows Electron's standard three-tier security model:

```text
Electron Main Process
        |
        | IPC (ipcMain.handle / ipcRenderer.invoke)
        |
Preload (contextBridge)
        |
        |
Vue 3 Renderer
```

- **Main** (`src/main/`) owns every privileged capability: spawning `adb`,
  reading/writing the SQLite database, showing native dialogs. It has full
  Node.js access; nothing here is reachable from the renderer except through
  the IPC channels explicitly registered in `register-ipc-handlers.ts`.
- **Preload** (`src/preload/index.ts`) runs sandboxed: it can use
  `electron`'s `contextBridge`/`ipcRenderer` and web APIs, but no Node.js
  built-ins (a `node:*` import makes the whole script fail to load;
  `tests/preload/sandbox-imports.test.ts` guards against that). It exposes
  one object, `window.droidor`, via `contextBridge.exposeInMainWorld`, and
  nothing else. Every method on it forwards to exactly one IPC channel and
  validates the response with a Zod schema before returning it — a bug in a
  main-process handler can't leak a malformed shape into untyped renderer
  code. Rejections lose Electron's "Error invoking remote method …" prefix
  on the way, so the renderer shows the handler's own message.
- **Renderer** (`src/renderer/`) is a normal Vue 3 + Vite single-page app.
  `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`
  are all set on the `BrowserWindow` (see `src/main/index.ts`), so the
  renderer has no Node.js or filesystem access beyond `window.droidor`.

## IPC design

Every channel name lives in one place: `src/shared/constants/ipc-channels.ts`
(`IpcChannel` for request/response calls, `IpcEventChannel` for the two
main-to-renderer push channels: device-list updates and device-transfer
progress). Nothing outside that
file references a channel as a raw string, so a typo becomes a compile
error rather than a silently-dead handler.

`register-ipc-handlers.ts` is the only place that calls `ipcMain.handle` —
the full set of channels the renderer can ever reach is visible in one file.
Handlers are grouped by feature under `src/main/ipc/handlers/` (devices,
dashboard, packages, analyzer, operations, recovery, APK install, split
install, device transfer, APK backup, security review, logs, safety
disclaimer, ADB settings, AI, update check, support links, app info).

Every payload crossing the boundary is validated with
[Zod](https://zod.dev), in both directions:

- A handler parses its incoming `payload: unknown` with a request schema
  from `src/shared/validation/` before touching it.
- The preload wrapper parses the handler's response with a matching result
  schema before handing it to the renderer.

## The ADB layer

Everything the rest of the app needs from ADB is behind one narrow
interface, `AdbClient` (`src/main/adb/adb-client.ts`):

```text
AdbClient (interface)
   |
   +-- RealAdbClient      spawns the real `adb` binary
   |
   +-- FakeAdbClient       in-memory, used by the entire test suite
   |
   +-- LoggingAdbClient    decorator: wraps either of the above,
                           records every call to AdbCommandLog
```

`RealAdbClient` only ever runs a fixed, hard-coded argv array chosen in
source code — never a shell string, and never anything built from
renderer/user input. This is deliberate: it's the mechanism that keeps
"predefined ADB operations only" (no arbitrary shell execution) true
throughout the app, not just a convention. See `SECURITY.md`.

`LoggingAdbClient` wraps the real client once, in `app-context.ts`, so every
service that calls `shellCommand`/`runMutationCommand`/`pullFile`/
`installApk` gets timed and logged automatically — no individual call site
needs to know logging exists. This is what powers the Logs page.

`FakeAdbClient` (`tests/fakes/`) implements the same interface entirely in
memory (keyed shell/mutation responses, recorded call history), so the full
test suite never needs a real device. Running the app itself always uses
`RealAdbClient`.

## Install flows

Installing is the app's main job, and the route `/` redirects to
`/install`. `InstallView.vue` has one drop zone that accepts every supported
file type and routes it, plus three sources:

- **From file** (`SingleApkInstallPanel.vue`): each `.apk` is parsed locally
  first (`local-apk-inspector.ts`) and compared with what's on the phone
  (`apk-install.service.ts`: new install, update, reinstall or downgrade),
  then installed with `adb install -r`.
- **Split / Bundle** (`SplitApkInstallPanel.vue`): an archive, a folder or a
  set of files is resolved into parts (`split-apk-discovery.ts`,
  `split-apk-inspector.ts`), each part classified (`split-apk-classifier.ts`)
  and checked against the phone's ABI list and density.
  `buildSplitInstallAnalysis` produces the reviewable plan;
  `performSplitInstall` runs `adb install-multiple` with the selected parts.
  Archives are extracted to a temporary directory that is always removed
  afterwards, and a sweep at startup removes any left behind by a crash.
- **From another device** (`DeviceTransferPanel.vue`): lists the source
  phone's user-installed apps (`getDeviceTransferPackages`), pulls the
  chosen app's APK files to a temporary directory
  (`stagePackageFromDevice`), and then reuses the split-install analysis and
  install for the target phone (`analyzeDeviceTransfer`,
  `performDeviceTransfer`), with per-file progress sent over
  `IpcEventChannel.DeviceTransferProgress`. The review step
  (`DeviceTransferReview.vue`) is shared with the "Copy to device…" dialog
  in Apps. Source and target are locked when the analysis starts, and the
  result is discarded if either disconnects.

Install timeouts scale with the file size (`installTimeoutMs` in
`adb-client.ts`) and pulls allow 30 minutes, so large bundles aren't cut
off. Every install is recorded in operation history.

## App-level services

Created in `src/main/index.ts` and `app-context.ts`:

- **Window hardening** (`window-security.ts`): navigation is limited to the
  app's own page, `window.open` is always denied (allow-listed `https`
  links go to the system browser), permissions are denied except clipboard
  writes, and `<webview>` can't be attached. Details in `SECURITY.md`.
- **Logging** (`logging/file-logger.ts`): a size-capped, rotating log file in
  `userData/logs`, written synchronously and never throwing. It records
  startup, errors from both processes, and every ADB command (via the
  `AdbCommandLog` sink).
- **Crash handling** (`crash-handlers.ts`): uncaught exceptions and startup
  failures are logged, shown once in an error dialog, the database is
  closed, and the app exits with code 1. Renderer errors (Vue's
  `errorHandler`, `error` and `unhandledrejection`) are sent to the log and
  shown as a toast.
- **Update check** (`update/update-check.service.ts`): at most once per day,
  one request to GitHub's latest-release endpoint; the result is cached in
  `app_settings` and can be switched off. Nothing is downloaded.
- **Smoke test** (`smoke-test.ts`): `--smoke-test` starts the app against a
  throwaway profile, checks the database and that the preload and Vue app
  loaded, then exits 0 or 1. CI runs it on every packaged build.

## Package analysis

`fetchInstalledPackages` (`src/main/android/package.service.ts`) turns a
fixed, small number of `adb shell` calls (never one call per package) into
the full installed-package list, merging `pm list packages` output with a
`dumpsys package packages` dump for version/install-time info.

`analyzeDevice` (`analyzer.service.ts`) layers a local, offline risk
classifier (`risk-classifier.ts`) plus a curated table of well-known package
names (`known-package-names.ts`) on top of that list to produce reviewable
recommendations. This local analyzer is what generates every recommendation
shown across the app — it never depends on network access, and nothing
below changes that.

### Optional AI analysis

A second, separate, on-demand capability sits alongside the local analyzer
rather than replacing or feeding into it: `src/main/ai/` defines a narrow
`AiProvider` interface (`analyzePackage(input, config) => { text, model }`)
with two real implementations, `AnthropicProvider` and
`OpenAiCompatibleProvider` (`src/main/android/ai-analysis.service.ts` picks
between them based on what's configured in Settings). Both post a single
JSON request via Electron's `net.request` — the same module the
platform-tools downloader uses — and both take their actual HTTP call as an
injectable constructor parameter purely for testability (Electron's `net`
isn't available under Vitest), the identical pattern
`platform-tools-manager.ts` already established for its own download
function.

This is only ever triggered per-package, on demand ("Ask AI" in the Apps
drawer) — never automatically, never in bulk across a device. The result is
rendered as free-text "AI opinion", never parsed into a `RiskLevel` or
merged into the local analyzer's own output: per the original
specification, AI output is advisory information, not authoritative truth.
The API key is encrypted at rest via Electron's `safeStorage`
(`ai-settings.repository.ts`, itself injectable the same way, for the same
reason) and is never returned to the renderer once saved.

This is a narrower realization of the specification's suggested
`PackageAnalysisProvider` abstraction (local rules / knowledge base / AI /
web research) — scoped here to just the AI leg, kept deliberately separate
from (not layered underneath) the existing local classifier, rather than
unifying both behind one shared interface.

## Persistence

A single SQLite database (`better-sqlite3`) lives in Electron's `userData`
directory. `src/main/persistence/migrations.ts` holds a linear, numbered
list of migrations applied against `PRAGMA user_version` — safe to run on
every startup, since an up-to-date database runs zero migrations. Before
migrating an existing database, `database.ts` copies it with `VACUUM INTO`
to `droid-or.backup-v<old version>.db` (the two newest copies are kept) and
restores that copy if a migration fails.

Dedicated tables exist for device history, operation history, ignored
packages, favorited ("Important") packages, and cached app metadata
(label/icon resolved from a pulled APK). A small generic `app_settings`
key/value table (`settings.repository.ts`) covers everything else that
doesn't warrant its own table — a custom ADB path override, the first-launch
safety-disclaimer acknowledgment, the update-check setting and its cached
result.

The in-session ADB command log (see above) is deliberately **not**
persisted in the database — it's a live troubleshooting view, not part of
the "what has this app changed" record the spec asks for. The same commands
do go to the size-capped log file, which is what users attach to bug
reports.

## Renderer structure

- `stores/` — one Pinia setup-store per feature domain (devices, packages,
  analyzer, operations, recovery, security review, logs, ...). Nearly every
  store follows the same `loading` / `errorMessage` / result triad.
- `views/` — one top-level component per route, via `router/index.ts`
  (hash history, since production builds load from a `file://` URL with no
  server to fall back to for HTML5 history mode). `AppShell.vue` shows
  Install as the primary action, then the device views (Overview, Apps |
  Analyzer, Profiles, Recovery, Security | History); Settings and Logs sit
  in the header.
- `components/` — shared, cross-view pieces: confirmation dialogs, the
  first-launch safety disclaimer and setup guide, backup/profile-apply
  dialogs, and `install/` for the three install panels.
- `composables/`, `utils/` — small, focused helpers (theme resolution,
  device-state display metadata, formatting).

Business logic and ADB access deliberately do not live in `.vue` files —
a view reads from a store and calls store actions; the store is the only
thing that talks to `window.droidor`.

## Testing

`tests/` mirrors `src/` (`tests/main/...`, `tests/renderer/...`), using
[Vitest](https://vitest.dev). Nothing in the suite requires a physical
device: main-process tests build an in-memory SQLite database per test and
inject `FakeAdbClient`; renderer store tests stub `window.droidor` directly.

Store tests generally mount a minimal real component that reads store state
through Vue's reactivity system (`@vue/test-utils`), rather than asserting
on the store object directly — this is what actually catches a mutation
that bypasses the reactive proxy, which a bare "call the action, read the
field" assertion would miss.

## Build and release

`electron-builder.yml` packages Windows (NSIS installer and portable, x64),
Linux (AppImage, x64) and macOS (DMG, arm64, ad-hoc signed). Each platform
is built on its own GitHub-hosted runner by `.github/workflows/build.yml`,
which `release.yml` calls for every `v*.*.*` tag before publishing a draft
release with checksums and build provenance. `DEVELOPMENT.md` describes the
workflows; `RELEASING.md` the release procedure.
