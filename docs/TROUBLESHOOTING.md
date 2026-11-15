# Troubleshooting

Find your symptom below. If nothing here helps, open an issue and attach the
log file (see [Collecting logs](#collecting-logs-for-a-bug-report)).

- [Starting droid.or](#starting-droidor)
  - [Windows](#windows) · [Linux](#linux) · [macOS](#macos-experimental)
- [The phone doesn't show up or isn't usable](#the-phone-doesnt-show-up-or-isnt-usable)
- [An install fails](#an-install-fails)
- [Copying from another device](#copying-from-another-device)
- [Collecting logs for a bug report](#collecting-logs-for-a-bug-report)

## Starting droid.or

### Windows

**"Windows protected your PC" (Microsoft Defender SmartScreen).** The
downloads aren't code-signed yet, so SmartScreen doesn't recognise them.
Click **More info → Run anyway**. To make sure the file is the one this
project published, compare its checksum with `SHA256SUMS.txt` from the
same release first:

```powershell
Get-FileHash .\droid.or-<version>-x64-setup.exe -Algorithm SHA256
```

**Your antivirus quarantines the portable `.exe`.** Some antivirus engines
are suspicious of unsigned, self-extracting programs. Use the installer
(`-setup.exe`) instead, or restore the file and report the false positive to
your antivirus vendor. Please don't disable your antivirus.

**The portable version takes several seconds to start.** It unpacks itself
to a temporary folder on every start. The installed version (`-setup.exe`)
starts faster. Both use the same data in `%APPDATA%\droid.or`, so you can
switch at any time.

### Linux

**Nothing happens when you double-click the AppImage.** Make it executable
first:

```bash
chmod +x droid.or-<version>-x86_64.AppImage
```

**An error mentioning FUSE or `libfuse.so.2`.** AppImages need FUSE 2, which
newer distributions don't install by default:

```bash
sudo apt install libfuse2t64   # Ubuntu 24.04 and newer, Debian 13
sudo apt install libfuse2      # Ubuntu 22.04, Debian 12
```

Without installing anything, you can also run
`./droid.or-<version>-x86_64.AppImage --appimage-extract-and-run`.

**It exits immediately with an error about the sandbox** (for example
"No usable sandbox!" or "The SUID sandbox helper binary was found, but is
not configured correctly"). Ubuntu 23.10 and newer restrict the user
namespaces that Electron's sandbox uses. Start it with `--no-sandbox`:

```bash
./droid.or-<version>-x86_64.AppImage --no-sandbox
```

This turns off Chromium's renderer sandbox. droid.or's other protections
(context isolation, no Node.js in the page, a strict Content Security Policy
and validated IPC) stay in place, and the page only ever shows droid.or's own
bundled interface, but it is a reduction in defence in depth. This problem
hasn't been confirmed for droid.or yet; if you hit it, please say so in an
issue with your distribution and version.

**The phone shows as "No permission".** Your user isn't allowed to access
the USB device. Add a udev rule as described in
[`ADB.md`](../ADB.md#usb-permissions-udev), or install your distribution's
rules package (for example `android-sdk-platform-tools-common` on
Debian/Ubuntu or `android-udev-rules` on Arch).

### macOS (experimental)

**"droid.or can't be opened" / "Apple could not verify…".** The app isn't
notarized. Try to open it once, then go to **System Settings → Privacy &
Security**, scroll down to the message about droid.or and click
**Open Anyway**.

**"droid.or is damaged and can't be opened".** macOS says this about
downloaded apps that aren't notarized. If the checksum matches
`SHA256SUMS.txt`, remove the download quarantine flag and open it again:

```bash
xattr -dr com.apple.quarantine /Applications/droid.or.app
```

The maintainer has no Mac to test with, so reports of what does and doesn't
work on macOS are very welcome.

## The phone doesn't show up or isn't usable

**A red "ADB is not available" banner.** droid.or can't run `adb`. Open
**Settings → ADB Connection** and click **Download Platform-Tools**, or point
it at an `adb` you already have. See [`ADB.md`](../ADB.md).

**The phone isn't listed at all.** Work through these in order:

1. Use a cable that carries data. Many charging cables don't; if the phone
   doesn't offer USB options when plugged in, try another cable or port.
2. Check that **USB debugging** is on: Settings → About phone → tap
   **Build number** seven times, then Settings → System → Developer options
   → **USB debugging**. Settings → **Show setup guide** in droid.or shows
   the steps.
3. Some phones only expose debugging in a particular USB mode. Pull down the
   notification shade, tap the USB notification and choose **File transfer**.
4. **Windows:** install a USB driver for the phone. Without one, Device
   Manager lists the phone with a warning sign (often under "Other devices")
   and ADB can't see it. Use the manufacturer's driver, or Google's USB
   driver for Pixel phones. Then unplug and replug the phone.
5. **Linux:** see "No permission" above.

**"Unauthorized".** Unlock the phone and accept the **Allow USB debugging?**
prompt (tick **Always allow from this computer**). If no prompt appears, go
to Developer options → **Revoke USB debugging authorizations**, then unplug
and replug the phone.

**"Offline".** The connection stalled. Unplug the phone and plug it back in.
If that doesn't help, toggle USB debugging off and on, or restart droid.or.

**Devices keep disconnecting, or `adb` reports a version mismatch.** Another
program (Android Studio, an older `adb`, phone management software) is
running a different ADB server. Close it, or set droid.or to use the same
`adb` as that program in Settings → ADB Connection.

## An install fails

When Android rejects an install, droid.or shows Android's reason and an
explanation. The most common ones:

| Android says                                                          | What it means and what to do                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE`                                  | The app is already installed with a different signature (for example from another store or a modified build). Android only allows updates signed by the same key. Uninstalling the existing app first works, but **deletes its data**. |
| `INSTALL_FAILED_VERSION_DOWNGRADE`                                    | The phone has a newer version. Android doesn't allow downgrades over ADB without removing the app first.                                                                                                                               |
| `INSTALL_FAILED_INSUFFICIENT_STORAGE`                                 | Not enough free space on the phone. The target strip on the Install page shows how much is free.                                                                                                                                       |
| `INSTALL_FAILED_NO_MATCHING_ABIS`                                     | The app contains native code for a different processor (for example an x86-only build on an ARM phone). Get a build for the phone's ABI, shown in the target strip.                                                                    |
| `INSTALL_FAILED_OLDER_SDK`                                            | The app needs a newer Android version than the phone has.                                                                                                                                                                              |
| `INSTALL_FAILED_USER_RESTRICTED`                                      | The phone blocked installs over USB. On Xiaomi, Redmi and POCO phones, turn on Developer options → **Install via USB**; on other phones, accept the install prompt on the screen.                                                      |
| `INSTALL_FAILED_MISSING_SPLIT` / `INSTALL_FAILED_INVALID_APK`         | A split bundle is incomplete. Install it under **Split / Bundle** with all its parts (including the language and density parts for this phone), not just `base.apk`.                                                                   |
| `INSTALL_PARSE_FAILED_NO_CERTIFICATES` / `…INCONSISTENT_CERTIFICATES` | The APK isn't signed, or its parts are signed with different keys. The file is damaged or was modified; download it again from its original source.                                                                                    |

## Copying from another device

**The app isn't in the source device's list.** Only apps you installed
yourself are listed. Preinstalled system apps can't be copied.

**The copy succeeds, but the app doesn't work on the target.** Only the app
is copied: its data, accounts and logins are not. Some apps also check that
they were installed from Google Play (licensing or Play Integrity) and refuse
to run otherwise. Install those from the Play Store on the target phone.

## Collecting logs for a bug report

droid.or keeps a log file of its start-up, errors and every ADB command it
ran. In the app, go to **Logs → Open Log Folder**, or find it here:

| System  | Log folder                                    |
| ------- | --------------------------------------------- |
| Windows | `%APPDATA%\droid.or\logs`                     |
| Linux   | `~/.config/droid.or/logs`                     |
| macOS   | `~/Library/Application Support/droid.or/logs` |

Attach `droid-or.log` to your
[issue](https://github.com/oscar-renteria/droid.or/issues/new/choose). It
contains device serial numbers and package names, but nothing from inside
your apps and no account data; look it over before sharing if that matters
to you.
