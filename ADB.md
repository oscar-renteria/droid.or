# ADB Setup

droid.or talks to Android devices exclusively through the Android Debug
Bridge (ADB). This page covers how the app finds/obtains an `adb`
executable, and platform-specific USB setup.

## How droid.or picks an `adb` executable

Priority order (`resolveEffectiveAdbCommand`, `src/main/adb/adb-settings.service.ts`):

1. **A custom path**, if you've set one on the Settings page. Validated
   (actually run and checked) before being saved — a broken path never
   silently becomes the app's only ADB.
2. **A managed download**, if one has already been installed by droid.or
   itself (see below).
3. Whatever `adb` resolves to on your system `PATH`.

The Settings page shows which of these is currently in effect and lets you
switch between them at any time; switching takes effect immediately for new
commands, and restarts the persistent device-list watch so it picks up the
new binary too.

## Managed platform-tools download

If you don't already have `adb` installed, Settings offers a "Download
platform-tools" button. This downloads the **official** `platform-tools`
package directly from Google's own distribution server
(`https://dl.google.com/android/repository/platform-tools-latest-<os>.zip`)
— the same URL Android Studio's own SDK Manager uses, not a third-party
mirror — extracts it into droid.or's own data directory, and verifies the
extracted binary actually runs before switching to it.

Google currently publishes exactly one build per OS: `windows`, `darwin`
(macOS), and `linux` (64-bit x86 only — there is no separate Linux ARM64
build, so the managed download isn't available on Linux ARM64; use a
system-installed or custom-path `adb` there instead).

## Authorizing a device

The first time you connect a device with USB debugging enabled, Android
shows an "Allow USB debugging?" prompt with an RSA key fingerprint. You
must accept it on the device itself — droid.or shows the device as
"Unauthorized" until you do. Checking "Always allow from this computer"
avoids repeating this on every reconnect.

## Linux

### USB permissions (udev)

A regular Linux user typically can't access a USB device directly without
a udev rule granting permission. If droid.or reports a device as
"No permission", add one:

1. Create `/etc/udev/rules.d/51-android.rules` (root privileges required),
   with one line identifying your device's USB vendor:

   ```text
   SUBSYSTEM=="usb", ATTR{idVendor}=="XXXX", MODE="0666", GROUP="plugdev"
   ```

   Replace `XXXX` with your device's vendor ID (four hex digits) from
   `lsusb` — or, for a broader rule that covers any USB device without
   needing a specific vendor ID (fine for a personal development machine):

   ```text
   SUBSYSTEM=="usb", MODE="0666", GROUP="plugdev"
   ```

2. Reload udev and reconnect the device:

   ```bash
   sudo udevadm control --reload-rules
   sudo udevadm trigger
   ```

3. Make sure your user is in the `plugdev` group (log out/in again after
   this if you weren't already):

   ```bash
   sudo usermod -aG plugdev $USER
   ```

### Distribution differences

Group naming (`plugdev` vs. distro-specific alternatives) and whether a
udev-rules package is already provided out of the box varies by
distribution — some ship one (e.g. an `android-udev-rules` package)
covering common vendor IDs already, in which case the manual steps above
aren't needed.

## Windows

Windows generally requires a USB driver for the device to be recognized at
all, separate from ADB itself: either the manufacturer's own driver, or
Google's generic "Google USB Driver" (available through Android Studio's
SDK Manager, or as a standalone download from Google). Without it, the
device may not appear to `adb devices` even with debugging enabled.

Windows Defender/firewall haven't been observed to interfere with local
USB ADB communication (it isn't a network operation), but this hasn't been
specifically verified against Windows in this project's own development
environment (which is Linux) — if you hit an unexpected block, check
Defender's app-specific exclusions as a first step.

## macOS

No additional USB driver is normally required. Code signing/notarization
for a packaged, distributable build is a separate concern from ADB
connectivity itself and is not yet configured in this project (see
`DEVELOPMENT.md`).

## Common connection states

droid.or surfaces these states per device (see
`src/renderer/src/utils/device-state-meta.ts`):

| State                    | Meaning                                                         |
| ------------------------ | --------------------------------------------------------------- |
| Connected                | Ready to use                                                    |
| Unauthorized             | Accept the RSA prompt on the device screen                      |
| Authorizing              | Waiting for you to respond to that prompt                       |
| Offline                  | Listed by `adb` but not responding — try reconnecting the cable |
| Sideload / Recovery mode | Device is in a bootloader-adjacent mode                         |
| No permission            | A Linux udev rule is needed — see above                         |
