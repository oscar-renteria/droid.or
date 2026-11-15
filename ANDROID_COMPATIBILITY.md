# Android Compatibility

droid.or targets **non-rooted** Android devices and relies only on standard
`pm`/`dumpsys`/`settings` commands available over ADB. It does not require
root, and does not assume every device exposes every property.

This page distinguishes what has actually been verified against real
hardware during this project's development from what's expected to work
based on documented Android/ADB behavior but hasn't been specifically
tested.

## Verified against real devices

The following devices have been used during development to verify real
`adb`/`pm`/`dumpsys` output (not just documented behavior):

| Device                              | Android     | Manufacturer/chipset | Verified                                                                                                                |
| ----------------------------------- | ----------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Galaxy Z Flip7 (SM-F766B)           | 16 (SDK 36) | Samsung              | Device dashboard, package listing, disable/enable/uninstall-for-user/clear-data, APK install & backup, Debloat Profiles |
| Lenovo Tab M10 FHD Plus (TB-X606XA) | 10 (SDK 29) | Lenovo               | Package listing (including a real disabled-package detection bug — see below), Security Review                          |
| FOSSiBOT DT1                        | 13          | MediaTek             | Package listing, system-app enumeration, Device Admin/Accessibility Service detection, disabling a system app           |
| Unihertz Jelly 2E                   | 12          | —                    | Package listing, Favorites/Important-app marking                                                                        |

This spans Android 10 through 16 and four different manufacturers/ODMs,
which has already surfaced real, non-obvious version/OEM differences (see
below) — but it is not exhaustive. Nothing here has been verified against
Android 11, 14, or 15 specifically, nor against Xiaomi/HyperOS,
OnePlus/OxygenOS, Oppo/ColorOS, Vivo, Motorola, or a stock Google Pixel
build. Those are expected to work, since droid.or only uses standard AOSP
`pm`/`dumpsys` commands with no manufacturer-specific code paths — but
"expected to work" is not the same claim as "verified."

## Install and copy between devices

| Feature                                         | Real hardware               | Otherwise covered by                                                                             |
| ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| Single APK install (`adb install -r`)           | Galaxy Z Flip7 (Android 16) | Unit tests                                                                                       |
| Split / bundle install (`adb install-multiple`) | Not yet                     | Unit tests; end-to-end run of the packaged app against a simulated `adb` with a real APK (UX-02) |
| Copy from another device                        | Not yet                     | Unit tests; end-to-end run against two simulated phones (UX-02)                                  |
| Bundles larger than 1 GB                        | Not yet                     | Timeout scaling covered by unit tests                                                            |

Real-device testing of these (at least three phones, Android 10, 13 and
15 or newer, two manufacturers) is planned before 1.0 (QA-04 in
`features/ROADMAP_TO_PRODUCTION.md`); results will be added to the table
above.

Limits by design:

- **Copy from another device** only offers apps the user installed
  (`pm list packages -3`), and only copies APK files from the app storage
  area (`/data/app/…`, or adopted storage on an SD card). Preinstalled apps
  can't be copied. App data, accounts and logins are not copied, and apps
  that check Google Play licensing or Play Integrity may refuse to run on
  the target.
- **Split bundles** must include a base APK and the parts the target phone
  needs. droid.or preselects the matching CPU architecture, screen density
  and language parts; installing an incomplete set fails on the phone.
- Some phones block installs over USB unless a setting is turned on (for
  example **Install via USB** in Developer options on Xiaomi, Redmi and
  POCO phones). Android then reports `INSTALL_FAILED_USER_RESTRICTED`.

## Known version/OEM differences found in practice

### `pm list packages -d` / `-3` needs `-u` on some devices

`pm list packages -d` (disabled packages) and `pm list packages -3`
(third-party packages) can **silently omit** a package entirely — not just
misreport its state — unless `-u` ("also include uninstalled packages") is
also passed. This was found on the Android 10 Lenovo tablet above: a
genuinely disabled Gmail was completely absent from `-d` output without
`-u`, which caused droid.or to (incorrectly) report the disable operation
as having failed, when it had actually succeeded. The same device showed
the identical gap for `-3` with a disabled third-party app.

The Android 16 Samsung device this project was originally built against
did **not** exhibit this gap — `-d` alone happened to list disabled
packages correctly there — which is exactly why it went unnoticed until a
second, older device was tested. droid.or now always passes `-u` alongside
both `-d` and `-3` (`src/main/android/package.service.ts`), verified with a
regression test using a fixture that reproduces the original gap.

**Lesson for future changes**: a `pm`/`dumpsys` flag combination that works
correctly on one device is not sufficient evidence it works on all of them
— test against more than one Android version/OEM before trusting a flag's
documented behavior.

### Budget/ODM devices and preloaded diagnostic tooling

Budget or white-label Android devices — the FOSSiBOT tablet above is one
example — commonly ship with factory/engineering-mode diagnostic tools
enabled in production builds (for example `com.mediatek.engineermode`,
`com.mediatek.factorymode` on MediaTek-chipset devices, or a
manufacturer's own `*.factorytest` package). These are a real, historically
exploitable attack-surface category on this class of hardware, not
malware, but not something a mainstream retail device typically ships with
enabled either. droid.or's Security Review page surfaces a couple of
related, ADB-visible signals (Device Admin apps, Accessibility Service
apps) for a human to review — it does not attempt to enumerate or flag
factory-diagnostic packages specifically, and is explicitly not a malware
scanner.

## Known limitations (by design, not a bug)

- **No root required, and no root support.** Every operation is something
  a non-rooted device's standard `pm`/`dumpsys` genuinely supports.
  Disabling a system app or uninstalling it "for the current user" is real
  and reversible; permanently removing it from the read-only system
  partition is not possible without root or reflashing, and droid.or never
  claims otherwise.
- **Bootloader status** is reported as a heuristic
  (`ro.boot.verifiedbootstate` where available), not queried through
  `fastboot` — a device would need to be rebooted into bootloader mode for
  that, which this app never does automatically.
- **Root detection** (`root-heuristic.ts`) combines several weak signals
  (build tags, `ro.debuggable`/`ro.secure`, a fixed su-binary path probe)
  into a graded verdict (`likely` / `possible` / `unlikely`), never a hard
  yes/no — no single ADB-visible signal reliably proves root status
  without root access itself. The su probe deliberately never invokes `su`
  itself, since that can pop a visible grant dialog on the phone or hang
  waiting for interaction.
- **APK backup** copies the APK file(s) already present on the device. It
  does not back up app data, signed-in accounts, encryption keys, DRM
  state, or anything server-side — reinstalling from a backed-up APK gives
  you a fresh install of that app, not its previous state.
- **"Restore Original State"** restores changes droid.or itself made and
  recorded (via `pm`), not a true firmware/system image restoration, and
  never performs a factory reset.
