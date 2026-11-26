# Packaging

Package-manager definitions for droid.or. Every package installs the
unchanged files from the GitHub release and checks them against
`SHA256SUMS.txt`.

| Manager          | Definition                                           | Installs                             | Status                                          |
| ---------------- | ---------------------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| Scoop (Windows)  | [`../bucket/droid-or.json`](../bucket/droid-or.json) | Portable `.exe`                      | Live: this repository is the bucket             |
| winget (Windows) | [`winget/manifests/`](winget/manifests/)             | NSIS installer, per user             | Needs a pull request to `microsoft/winget-pkgs` |
| AUR (Arch Linux) | [`aur/droid-or-bin/`](aur/droid-or-bin/)             | AppImage contents in `/opt/droid-or` | Needs an AUR account and push                   |

## Scoop

Users add this repository as a bucket:

```powershell
scoop bucket add droid-or https://github.com/oscar-renteria/droid.or
scoop install droid-or/droid-or
```

`checkver` and `autoupdate` let Scoop's tooling find new releases and their
hashes in `SHA256SUMS.txt`. To bump the manifest by hand after a release,
change `version`, the URL and `hash` in `bucket/droid-or.json`.

## winget

First submission:

1. Fork [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs).
2. Copy `winget/manifests/o/oscar-renteria/droid-or/<version>/` to the same
   path in the fork.
3. Optionally, on Windows: `winget validate --manifest <that folder>` and
   `winget install --manifest <that folder>` to test.
4. Open a pull request. Automated validation runs, then a moderator
   reviews it.

The identifier `oscar-renteria.droid-or` cannot be changed after the first
version is accepted.

Later versions: copy the version folder, update `PackageVersion`,
`ReleaseDate`, `InstallerUrl`, `InstallerSha256` (from `SHA256SUMS.txt`,
upper case) and `ReleaseNotesUrl`, and submit again. `wingetcreate update
oscar-renteria.droid-or --version <v> --urls <setup.exe URL> --submit` does
the same in one step.

## AUR

First submission (needs an account on aur.archlinux.org with an SSH key):

```bash
git clone ssh://aur@aur.archlinux.org/droid-or-bin.git
cp packaging/aur/droid-or-bin/{PKGBUILD,.SRCINFO} droid-or-bin/
cd droid-or-bin
makepkg -si          # on Arch: build and install once to test
namcap PKGBUILD *.pkg.tar.zst
git add PKGBUILD .SRCINFO && git commit -m "Initial release 1.0.0" && git push
```

Later versions: update `pkgver`, reset `pkgrel=1`, update `sha256sums`
(the AppImage line in `SHA256SUMS.txt`), regenerate `.SRCINFO` with
`makepkg --printsrcinfo > .SRCINFO`, commit both here and in the AUR
repository.

`.SRCINFO` was written by hand for 1.0.0 because it was prepared without an
Arch system; regenerate it with `makepkg --printsrcinfo` before the first
push and commit any difference.
