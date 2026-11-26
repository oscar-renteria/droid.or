# Changelog

All notable changes to droid.or are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Prereleases (betas and release
candidates) are not listed separately; their changes are part of the version
they lead up to.

## [Unreleased]

### Added

- About: links to star the project on GitHub and to report an issue.

## [1.0.0] - 2026-11-19

The first public release.

### Added

- **Install-first app.** droid.or opens on Install, with three sources:
  - **From file**: one or more `.apk` files, each inspected first (new
    install, update, reinstall or downgrade).
  - **Split / Bundle**: `.apks`, `.xapk` and `.apkm` archives, folders, or
    sets of split APKs; the parts matching the phone are preselected.
  - **From another device**: copy an installed app, including its split
    parts, from one connected phone to another, with progress per file and
    the source → target route in History.
- One drop zone that accepts every supported file type and picks the right
  flow, plus a target-device strip showing where an install will go.
- First-run setup guide for USB debugging, with live ADB status.
- Device tools: Overview, Apps (disable, enable, uninstall for user, clear
  data, APK backup, copy to device), Analyzer and Profiles for reviewed
  debloating, Recovery, Security, History and Logs.
- Daily check for a newer stable release on GitHub with an "Update" button
  that opens the release page; it can be switched off in Settings.
- Persistent, size-limited log file and an "Open Log Folder" button.
- Downloads for Windows (installer and portable), Linux (AppImage) and,
  experimentally, macOS on Apple silicon, each with SHA-256 checksums and
  build provenance attestations.

### Changed

- The database is backed up before a schema upgrade and restored if the
  upgrade fails.
- Install timeouts grow with the size of the files, and copying an app off
  a phone may take up to 30 minutes, so large bundles are no longer cut off.

### Security

- Navigation away from the app, new windows, `<webview>` and browser
  permissions are blocked; links open in the system browser only for an
  allow-list of `https` sites.
- Tighter Content Security Policy.
- Crashes and unexpected errors are logged and reported instead of leaving
  the app in an unknown state.

[Unreleased]: https://github.com/oscar-renteria/droid.or/compare/v1.0.0...master
[1.0.0]: https://github.com/oscar-renteria/droid.or/releases/tag/v1.0.0
