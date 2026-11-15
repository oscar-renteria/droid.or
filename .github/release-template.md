What changed in this version: see [`CHANGELOG.md`](https://github.com/{{REPO}}/blob/v{{VERSION}}/CHANGELOG.md).

## Downloads

| Platform                                | File                                    | Notes                                                    |
| --------------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| Windows 10/11 (x64), installer          | `droid.or-{{VERSION}}-x64-setup.exe`    | Installs per user, adds Start menu and desktop shortcuts |
| Windows 10/11 (x64), portable           | `droid.or-{{VERSION}}-x64-portable.exe` | No installation, just run it. Starts a bit slower        |
| Linux (x64)                             | `droid.or-{{VERSION}}-x86_64.AppImage`  | Single file, runs on most distributions                  |
| macOS (Apple Silicon), **experimental** | `droid.or-{{VERSION}}-arm64.dmg`        | Unsigned and untested by the maintainer — see below      |

Both Windows downloads contain the same app and keep their data in
`%APPDATA%\droid.or`, so you can switch between them.

droid.or can download Google's platform-tools (ADB) for you on first run, or
use an existing `adb`. You need USB debugging enabled on your Android device.

## Verify your download

Each file is listed in `SHA256SUMS.txt` and has a signed build provenance
attestation proving it was built by this repository's release workflow:

```bash
sha256sum --check --ignore-missing SHA256SUMS.txt          # Linux
shasum -a 256 --check --ignore-missing SHA256SUMS.txt      # macOS
gh attestation verify <file> --repo {{REPO}}               # any OS, needs GitHub CLI
```

On Windows (PowerShell): `Get-FileHash <file> -Algorithm SHA256`, then compare
with the matching line in `SHA256SUMS.txt`.

## First start

**Windows:** the executables are not code-signed yet, so Microsoft Defender
SmartScreen may show "Windows protected your PC". Click **More info → Run
anyway**. Your device also needs a USB driver for ADB (most manufacturers
provide one; Google's USB driver covers Pixel and Nexus devices).

**Linux:**

```bash
chmod +x droid.or-{{VERSION}}-x86_64.AppImage
./droid.or-{{VERSION}}-x86_64.AppImage
```

- If it fails with a FUSE error, install `libfuse2` (Ubuntu 24.04+:
  `sudo apt install libfuse2t64`; Ubuntu 22.04: `sudo apt install libfuse2`), or run with
  `--appimage-extract-and-run`.
- If it exits with a sandbox error (Ubuntu 23.10+ restricts unprivileged user
  namespaces), start it with `--no-sandbox`.
- If your device shows as "no permissions", add udev rules for Android
  devices (e.g. the `android-sdk-platform-tools-common` package).

**macOS (experimental):** this build is ad-hoc signed but not notarized, and
the maintainer has no Mac to test it — feedback is welcome in the issues.
macOS will block the first start. Open the app once, then go to **System
Settings → Privacy & Security**, scroll to the message about droid.or and
click **Open Anyway**.

More help: [Troubleshooting](https://github.com/{{REPO}}/blob/v{{VERSION}}/docs/TROUBLESHOOTING.md).
