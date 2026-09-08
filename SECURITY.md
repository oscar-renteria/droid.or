# Security

droid.or interacts with a user's phone and holds ADB capabilities powerful
enough to disable, uninstall, or reinstall applications on it. It's treated
as security-sensitive software accordingly.

## Electron process isolation

The main `BrowserWindow` (`src/main/index.ts`) is created with:

```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

The renderer has no Node.js, no `require`, and no filesystem access of its
own. Its only capability beyond standard web APIs is whatever the preload
script explicitly exposes.

## The preload boundary

`src/preload/index.ts` exposes exactly one object, `window.droidor`, via
`contextBridge.exposeInMainWorld`. Its shape is defined once, in
`src/shared/types/droidor-api.ts`, and the renderer depends only on that
shared contract — never on preload internals.

Every method:

1. Forwards to exactly one IPC channel.
2. Validates whatever comes back with a [Zod](https://zod.dev) schema
   before returning it to the renderer.

So a bug in a main-process handler that returns a malformed shape fails
loudly (a Zod parse error) rather than handing untyped, unchecked data to
renderer code.

## IPC input validation

Every `ipcMain.handle` callback in `src/main/ipc/handlers/` parses its
`payload: unknown` argument with a request schema before using any of it.
Nothing arrives in main-process code without going through validation
first — a device ID, package name, or file path from the renderer is never
trusted as already being the right shape.

## No arbitrary command execution

`AdbClient.shellCommand` / `runMutationCommand` (`src/main/adb/adb-client.ts`)
take a fixed `string[]` argv, run via `execFile` (never a shell), and that
argv is **always** a hard-coded array chosen in source code — never
built by concatenating or interpolating renderer/user input into a command
string. There is no general-purpose ADB shell/terminal feature in this app;
every mutating operation is one of a small, fixed set
(`disable` / `enable` / `uninstall-for-user` / `clear-data` /
`restore-install` / `install`), each mapped to its own predefined command.

Package names, device IDs, and file paths are validated (via Zod, and via
existing-device/existing-package checks) before being substituted as an
_argument_ to one of those fixed commands — never into the command itself.

## Device targeting

Every ADB call explicitly targets one serial (`adb -s <serial> ...`).
Before any mutating operation, the device is re-checked against the live
device registry (`assertDeviceConnected`) — a device that was connected
when a view loaded but has since been unplugged, gone unauthorized, or
switched to another state cannot silently receive a command intended for
the state it was previously in.

## Confirmation before anything destructive

Nothing mutates a device without an explicit, per-operation confirmation
dialog (`OperationConfirmDialog.vue`), with typed confirmation
(`type UNINSTALL` / `type CLEAR`) required for the combinations most likely
to surprise or be hard to reverse — an advanced/critical-risk package, a
system-app uninstall, or any package the user has marked "Important". A
one-time, blocking first-launch disclaimer (`SafetyDisclaimerModal.vue`)
covers the category of risk as a whole before any of those per-operation
dialogs are ever reached.

## Network usage

The only network request this app makes is one the user explicitly
triggers: downloading the official `platform-tools` package directly from
Google's own distribution server (`dl.google.com`) when the user clicks
"Download platform-tools" in Settings, having found no usable `adb`
otherwise. That download is verified (the extracted binary is actually run
and its version output checked) before it's trusted.

There is no telemetry, no analytics, and no other outbound network call
anywhere in the codebase. Package/device information is never sent
anywhere for analysis — the only analysis provider implemented today is
entirely local and offline (see `ARCHITECTURE.md`). If an AI/web-assisted
analysis provider is added in the future, per the original specification
it must be opt-in, must clearly disclose what's transmitted, and must
never be the only way the app functions.

## Local-first persistence

All state (device history, operation history, favorites/ignore lists,
settings) lives in a local SQLite database inside Electron's `userData`
directory. Nothing is synced to any remote service.

## Reporting a vulnerability

This is currently a private, unlicensed project with no public release —
if you have access to this repository and find a security issue, open an
issue here rather than a public disclosure elsewhere.
