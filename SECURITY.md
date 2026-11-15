# Security

## Reporting a vulnerability

Please report security problems **privately**: on GitHub, open the
repository's **Security** tab and click
[**Report a vulnerability**](https://github.com/oscar-renteria/droid.or/security/advisories/new).
Only the maintainers can see the report. Please don't open a public issue
for a vulnerability.

Include what's affected, how to reproduce it, and the droid.or version and
operating system. Fixes go into a new release, and the advisory is
published once that release is out.

Only the latest release receives security fixes.

## Overview

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
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: false
}
```

The renderer has no Node.js, no `require`, and no filesystem access of its
own. Its only capability beyond standard web APIs is whatever the preload
script explicitly exposes. Because the preload is sandboxed it cannot import
Node built-ins either; a test (`tests/preload/sandbox-imports.test.ts`)
enforces that.

### Hardening checklist

Implemented in `src/main/window-security.ts`, following Electron's security
recommendations:

- [x] Context isolation on, Node integration off, renderer sandboxed
- [x] `webSecurity` on, no insecure content, `<webview>` disabled — and any
      attempt to attach one is blocked app-wide (`will-attach-webview`)
- [x] Navigation restricted: `will-navigate` blocks every URL except the
      bundled renderer page (or the Vite dev server in development)
- [x] No new windows: `window.open`/`target="_blank"` is always denied; only
      `https` URLs on the allow-list (`github.com`, `paypal.me`) are handed to
      the system browser, anything else is dropped
- [x] Permissions denied by default: request and check handlers allow only
      `clipboard-sanitized-write` (copy-link fallback); camera, microphone,
      notifications, geolocation, USB/HID/serial etc. are refused
- [x] Content-Security-Policy in `src/renderer/index.html` limits scripts and
      network connections to the app itself
- [x] Every IPC payload validated with Zod in the main process (see below)
- [x] Blocked attempts are written to the log file as warnings

## What state this app keeps locally

Everything lives in Electron's per-user `userData` directory
(`%APPDATA%\droid.or` on Windows, `~/.config/droid.or` on Linux,
`~/Library/Application Support/droid.or` on macOS), created on first run
and never shipped inside the app:

- `droid-or.db` — a SQLite database with device history, operation history,
  the favorites / ignore list, settings, and the cached update-check result.
- `logs/droid-or.log` (+ up to two rotated files, 1 MB each) — app start
  lines, errors, and every ADB command run (including device serials and
  package names), for troubleshooting. Never uploaded; it only leaves the
  machine if the user attaches it to a bug report.
- `managed-adb/` — platform-tools, if downloaded from Settings.

Nothing is synced to any remote service.

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

There is no telemetry and no analytics. Apart from the update check below —
the only automatic network request, and one the user can switch off — every
network request this app makes is one the user explicitly triggers.

- **Update check** (automatic, on by default, Settings → Updates → "Check
  for updates"): at most once every 24 hours, one unauthenticated `GET` to
  `https://api.github.com/repos/oscar-renteria/droid.or/releases/latest`
  with a generic `User-Agent: droid.or-update-check`. Nothing about the user,
  the machine, or any device is sent; GitHub sees only the request itself
  (including the IP address, as with any web request). Only the release's
  version tag is read from the response; the release page link shown to the
  user is built locally from that validated tag, and nothing is downloaded or
  installed automatically. When switched off, no request is made at all.
- **Opening links** (release page, documentation, GitHub Sponsors and
  PayPal donation links): only on click,
  in the system browser, and only for `https` URLs on an allow-list.
- **Downloading `platform-tools`**: when the user clicks "Download
  platform-tools" in Settings, having found no usable `adb` otherwise, the
  official package is fetched directly from Google's own distribution
  server (`dl.google.com`) over HTTPS, and the extracted binary is run and
  its version output checked before it's used. droid.or doesn't verify a
  checksum or signature for this download: HTTPS and that version check are
  the only integrity checks. This is an accepted risk for 1.0. Using an
  `adb` you installed yourself (Settings → ADB Connection) avoids the
  download entirely.
- **AI-assisted package analysis** (optional, off by default): only when
  the user has configured a provider and API key in Settings, and only
  when they click "Ask AI" on one specific package, a single request goes
  to that provider (Anthropic's API, or a configured OpenAI-compatible
  endpoint). It sends only manufacturer/model/Android version, the
  package name, app label, version, requested permissions, and system/user
  classification — never a device serial, never other packages, never
  anything beyond that one package. This never runs automatically or in
  bulk across a device. The response is shown as advisory free text,
  labeled as such, and never merged into or treated as this app's own risk
  classification (see `ARCHITECTURE.md`). The API key itself is encrypted
  at rest via Electron's `safeStorage` (the OS's own keychain/credential
  store) and is never sent back to the renderer once saved.

No other package or device information is ever sent anywhere.

## Trademarks & Legal Disclaimers

`droid.or` is an independent open-source project licensed under the [MIT License](LICENSE) and is not affiliated with, sponsored by, or endorsed by Google LLC, Android, or device manufacturers.
