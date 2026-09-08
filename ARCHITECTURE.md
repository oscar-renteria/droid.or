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
- **Preload** (`src/preload/index.ts`) is the only file that runs with both
  a Node.js `require` and access to the page. It exposes one object,
  `window.droidor`, via `contextBridge.exposeInMainWorld`, and nothing else.
  Every method on it forwards to exactly one IPC channel and validates the
  response with a Zod schema before returning it — a bug in a main-process
  handler can't leak a malformed shape into untyped renderer code.
- **Renderer** (`src/renderer/`) is a normal Vue 3 + Vite single-page app.
  `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`
  are all set on the `BrowserWindow` (see `src/main/index.ts`), so the
  renderer has no Node.js or filesystem access beyond `window.droidor`.

## IPC design

Every channel name lives in one place: `src/shared/constants/ipc-channels.ts`
(`IpcChannel` for request/response calls, `IpcEventChannel` for the one
main-to-renderer push channel, device-list updates). Nothing outside that
file references a channel as a raw string, so a typo becomes a compile
error rather than a silently-dead handler.

`register-ipc-handlers.ts` is the only place that calls `ipcMain.handle` —
the full set of channels the renderer can ever reach is visible in one file.
Handlers are grouped by feature under `src/main/ipc/handlers/` (devices,
packages, analyzer, operations, recovery, APK install/backup, security
review, logs, safety disclaimer, ADB settings).

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

`FakeAdbClient` implements the same interface entirely in memory (keyed
shell/mutation responses, recorded call history), so the full test suite —
and development without a phone attached — never needs a real device.

## Package analysis

`fetchInstalledPackages` (`src/main/android/package.service.ts`) turns a
fixed, small number of `adb shell` calls (never one call per package) into
the full installed-package list, merging `pm list packages` output with a
`dumpsys package packages` dump for version/install-time info.

`analyzeDevice` (`analyzer.service.ts`) layers a local, offline risk
classifier (`risk-classifier.ts`) plus a curated table of well-known package
names (`known-package-names.ts`) on top of that list to produce reviewable
recommendations. This is the only analysis provider implemented today.

The original specification calls for this to sit behind a pluggable
`PackageAnalysisProvider` abstraction (local rules / knowledge base / AI /
web research), so an optional AI-assisted provider could be added later
without the app depending on it. That abstraction has **not** been built
yet — there's exactly one provider, and it's entirely local. No package
information is ever sent anywhere for analysis in the current codebase.

## Persistence

A single SQLite database (`better-sqlite3`) lives in Electron's `userData`
directory. `src/main/persistence/migrations.ts` holds a linear, numbered
list of migrations applied against `PRAGMA user_version` — safe to run on
every startup, since an up-to-date database runs zero migrations.

Dedicated tables exist for device history, operation history, ignored
packages, favorited ("Important") packages, and cached app metadata
(label/icon resolved from a pulled APK). A small generic `app_settings`
key/value table (`settings.repository.ts`) covers everything else that
doesn't warrant its own table — a custom ADB path override, the first-launch
safety-disclaimer acknowledgment.

The in-session ADB command log (see above) is deliberately **not**
persisted here — it's a live troubleshooting view, not part of the "what
has this app changed" record the spec asks for, and re-persisting routine
read traffic on every dashboard refresh would grow the database for no
real benefit.

## Renderer structure

- `stores/` — one Pinia setup-store per feature domain (devices, packages,
  analyzer, operations, recovery, security review, logs, ...). Nearly every
  store follows the same `loading` / `errorMessage` / result triad.
- `views/` — one top-level component per nav tab, routed via
  `router/index.ts` (hash history, since production builds load from a
  `file://` URL with no server to fall back to for HTML5 history mode).
- `components/` — shared, cross-view pieces: confirmation dialogs, the
  first-launch safety disclaimer, backup/profile-apply dialogs.
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
