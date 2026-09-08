# droid.or

A cross-platform desktop application for inspecting, analyzing, and debloating
Android devices connected over USB — without requiring root.

droid.or talks to a connected phone or tablet through the Android Debug Bridge
(ADB) and Android's own package manager. It never assumes root access, and it
is explicit about what it can and can't actually do on a stock, non-rooted
device: disabling a system app or uninstalling it "for the current user" are
real, supported operations; permanently deleting it from the read-only system
partition is not, and the app never claims otherwise.

## What it does

- **Device detection & history** — auto-detects connected devices, remembers
  every device that's ever been connected, and clearly distinguishes
  connected / unauthorized / offline / recovery states.
- **Device dashboard** — manufacturer, model, Android version, security patch
  level, battery, storage, RAM, root heuristic, and more, gracefully falling
  back to "Not available" for anything a specific device doesn't expose.
- **Installed applications** — browse, search, and filter every package on
  the device, with install source, disabled/enabled state, and version info.
- **Debloat Analyzer** — reviews preinstalled system packages against a local
  risk-classification database and produces reviewable, per-package
  recommendations. Nothing is ever removed automatically.
- **Debloat Profiles** — curated, reviewable bundles (Minimal, Recommended,
  Aggressive, and more) that still require an explicit confirmation before
  anything changes on the device.
- **Favorites / Important Apps** — mark specific packages as important to get
  a stronger, harder-to-miss confirmation before they're ever touched.
- **Package operations** — disable, enable, uninstall-for-user, and clear
  data, each with a tiered confirmation dialog (typed confirmation for the
  riskiest combinations).
- **Device Recovery** — a dedicated page showing everything this app has
  changed on a device, with the ability to restore individual packages or
  everything at once.
- **APK installer** — install or update local `.apk` files via drag & drop or
  a file picker, with pre-install inspection.
- **APK backup** — copy APKs already on the device to a local folder before
  making changes (this backs up the APK file itself, not app data/accounts).
- **Security Review** — an honestly-scoped page surfacing a few real,
  ADB-visible signals (Device Admin apps, Accessibility Service apps,
  non-Play-Store installs, recently changed apps) for a human to review.
  This is explicitly **not** malware detection.
- **Operation history & Logs** — a persisted record of every change this app
  has made, plus a live, in-session log of every ADB command it has run,
  exportable for troubleshooting.
- **Managed ADB** — detects an existing `adb` install, lets you point at a
  custom executable, or downloads the official platform-tools package
  directly from Google's own distribution server.
- **AI-assisted analysis (optional, off by default)** — an "Ask AI" button
  for a second opinion on one package at a time, using a provider and API
  key you configure yourself (Anthropic or any OpenAI-compatible endpoint).
  Nothing is sent anywhere unless you click it, and the result is shown as
  advisory only — it never overrides droid.or's own local classification.

See [`docs/specification.md`](docs/specification.md) for the full original product
specification this project is built against.

## Requirements

- Node.js (a current LTS release) and npm
- A working ADB setup, or let droid.or download one for you on first run —
  see [`ADB.md`](ADB.md) for platform-specific details
- USB debugging enabled on the Android device you want to manage

## Getting started

```bash
npm install
npm run dev
```

This starts the Vite dev server for the renderer and launches the Electron
app with hot reload. See [`DEVELOPMENT.md`](DEVELOPMENT.md) for the full set
of scripts (testing, linting, type-checking).

## Building

```bash
npm run build         # type-check + bundle main/preload/renderer
npm run build:linux   # + package as a Linux AppImage
```

Windows and macOS packaging targets (`build:win`, `build:mac`) exist as
scripts but aren't yet configured with platform-specific signing/notarization
in `electron-builder.yml` — see [`ADB.md`](ADB.md) and
[`ARCHITECTURE.md`](ARCHITECTURE.md) for what's actually been verified versus
what's still outstanding.

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — process architecture, IPC design,
  and how the codebase is organized
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — day-to-day development workflow
- [`SECURITY.md`](SECURITY.md) — the security model and what data ever
  leaves the device
- [`ADB.md`](ADB.md) — ADB setup and troubleshooting per platform
- [`ANDROID_COMPATIBILITY.md`](ANDROID_COMPATIBILITY.md) — what's been
  verified against real hardware, and known limitations
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — how to contribute

## Project status

This is an actively developed, milestone-by-milestone project. Core device
management, debloating, backup/restore, installer, and optional AI-assisted
analysis functionality are implemented and covered by an automated test
suite.

## License

Not currently licensed for external distribution or reuse.
