/**
 * Parses `pm path <package>`: one line per APK file belonging to that
 * package. Verified against a real device: a plain single-APK app (KDE
 * Connect) returns exactly one line; a package installed as an app bundle
 * (WhatsApp, Spotify) returns several — a base.apk plus one split_*.apk
 * per architecture/density/locale config actually present, not a fixed
 * count. A preinstalled product-partition app (Gmail) confirmed the file
 * isn't always literally named "base.apk", so callers should take the
 * filename from each returned path rather than assuming one.
 */
export function parsePackagePaths(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('package:'))
    .map((line) => line.slice('package:'.length))
}
