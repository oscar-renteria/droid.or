export interface RawPackageListEntry {
  packageName: string
  apkPath: string | null
  installerPackage: string | null
}

/**
 * Parses `pm list packages -f -i`. Verified against a real device: the apk
 * path itself can contain "=" characters (base64-padded hash directory
 * names under /data/app), so the path/package-name split must use the
 * *last* "=" on the line, not the first — e.g.
 * "package:/data/app/~~4_H8tYld6D1_axWyTpigyw==/com.foo-abc==/base.apk=com.foo  installer=com.android.vending".
 */
export function parsePackageListWithPathAndInstaller(output: string): RawPackageListEntry[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('package:'))
    .map((line) => {
      const withoutPrefix = line.slice('package:'.length)
      const installerMatch = /\s+installer=(\S+)$/.exec(withoutPrefix)
      const installerRaw = installerMatch?.[1] ?? null
      const withoutInstaller = installerMatch
        ? withoutPrefix.slice(0, installerMatch.index)
        : withoutPrefix

      const lastEquals = withoutInstaller.lastIndexOf('=')
      const apkPath = lastEquals >= 0 ? withoutInstaller.slice(0, lastEquals) : null
      const packageName =
        lastEquals >= 0 ? withoutInstaller.slice(lastEquals + 1) : withoutInstaller

      return {
        packageName,
        apkPath,
        installerPackage: installerRaw && installerRaw !== 'null' ? installerRaw : null
      }
    })
}

/** Parses the plain `package:<name>` format used by `pm list packages -d`
 *  and `pm list packages -3` (no path/installer fields). */
export function parsePackageNameList(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('package:'))
    .map((line) => line.slice('package:'.length))
}
