# QA Checklist — v1.0.0 Release Candidate

Use this checklist to sign off QA-02 (Windows) and QA-03 (Linux). Each line
must pass on a clean machine before the RC is considered clean. Record start
times and any workarounds, then sign off at the bottom.

Draft prerelease: **`droid.or 1.0.0-rc.1`** (`v1.0.0-rc.1`)
Assets:
- `droid.or-1.0.0-rc.1-x64-portable.exe`
- `droid.or-1.0.0-rc.1-x64-setup.exe`
- `droid.or-1.0.0-rc.1-x86_64.AppImage`
- `SHA256SUMS.txt`

Release page: https://github.com/oscar-renteria/droid.or/releases/tag/v1.0.0-rc.1

---

## QA-02 — Windows 10 and 11 (clean VMs)

Test both artifacts (`portable.exe` and `setup.exe`) on both Windows 10 and
Windows 11. All three install sources: **From file**, **Split / Bundle**,
**From another device**.

### Windows 10 — portable `.exe`
- [ ] SHA256 check against `SHA256SUMS.txt` passes
- [ ] SmartScreen bypass works (run anyway on unsigned portable)
- [ ] Cold-start time recorded: __________
- [ ] ADB download works on first run
- [ ] Device detection works (phone appears in device list)
- [ ] Install from file (single APK) works
- [ ] Install split bundle (`.apks`/`.xapk`/`.apkm`) works
- [ ] Install from another device works
- [ ] Uninstall leaves no residue

### Windows 10 — NSIS installer `.exe`
- [ ] Silent install (`/S`) succeeds
- [ ] Install over previous RC (upgrade) works
- [ ] Uninstall works; data in `%APPDATA%\droid.or` kept after uninstall
- [ ] Re-install after uninstall preserves data
- [ ] All three install sources work (as above)

### Windows 11 — portable `.exe`
- [ ] SHA256 check against `SHA256SUMS.txt` passes
- [ ] SmartScreen bypass works
- [ ] Cold-start time recorded: __________
- [ ] ADB download works
- [ ] Device detection works
- [ ] All three install sources work

### Windows 11 — NSIS installer `.exe`
- [ ] Silent install (`/S`) succeeds
- [ ] Install over previous RC works
- [ ] Uninstall works; `%APPDATA%` data kept
- [ ] All three install sources work

**QA-02 signed off by:** __________  **Date:** __________

---

## QA-03 — Linux (Ubuntu 22.04, Ubuntu 24.04, Fedora)

Test the `x86_64.AppImage` on each distro. All three install sources.

### Ubuntu 22.04
- [ ] `libfuse2` present (or workaround documented)
- [ ] `chmod +x droid.or-1.0.0-rc.1-x86_64.AppImage` succeeds
- [ ] AppImage launches successfully
- [ ] Sandbox behaviour (AppImage sandbox) — works or `--no-sandbox` workaround documented
- [ ] udev rules for ADB device access configured
- [ ] ADB download works on first run
- [ ] Device detection works
- [ ] Install from file (single APK) works
- [ ] Install split bundle works
- [ ] Install from another device works

**Workarounds needed:** __________

### Ubuntu 24.04
- [ ] `libfuse2`/`libfuse2t64` present (or workaround documented)
- [ ] `chmod +x droid.or-1.0.0-rc.1-x86_64.AppImage` succeeds
- [ ] AppImage launches successfully
- [ ] Sandbox behaviour: AppArmor/unprivileged user namespace restriction — works or `--no-sandbox` workaround documented (risk R2)
- [ ] udev rules for ADB device access configured
- [ ] ADB download works on first run
- [ ] Device detection works
- [ ] Install from file (single APK) works
- [ ] Install split bundle works
- [ ] Install from another device works

**Workarounds needed:** __________

### Fedora (current)
- [ ] `chmod +x droid.or-1.0.0-rc.1-x86_64.AppImage` succeeds
- [ ] AppImage launches successfully
- [ ] Sandbox behaviour works
- [ ] udev rules for ADB device access configured
- [ ] ADB download works on first run
- [ ] Device detection works
- [ ] Install from file (single APK) works
- [ ] Install split bundle works
- [ ] Install from another device works

**Workarounds needed:** __________

**QA-03 signed off by:** __________  **Date:** __________

---

## Common (both platforms)

- [ ] All three install sources verified on at least one Windows and one Linux machine
- [ ] SHA256SUMS.txt verification documented for each artifact
- [ ] Workarounds documented above (if any)