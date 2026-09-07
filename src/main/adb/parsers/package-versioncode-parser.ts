export interface PackageVersionEntry {
  packageName: string
  versionCode: number | null
}

/**
 * Parses `pm list packages --show-versioncode`. Documented format
 * ("package:<name> versionCode:<code>") — not verified against a real
 * device this session (none was connected while this was written), unlike
 * the plain `pm list packages` format this project has verified
 * extensively elsewhere. Lines that don't match the expected shape are
 * skipped rather than throwing, consistent with how every other parser in
 * this app treats unexpected adb output as absent data, not a crash.
 */
export function parsePackageVersionCodeList(output: string): PackageVersionEntry[] {
  const pattern = /^package:(\S+)\s+versionCode:(-?\d+)$/gm
  return [...output.matchAll(pattern)]
    .map((match) => {
      const packageName = match[1]
      const versionCodeRaw = match[2]
      if (!packageName || versionCodeRaw === undefined) {
        return null
      }
      const versionCode = Number.parseInt(versionCodeRaw, 10)
      return { packageName, versionCode: Number.isFinite(versionCode) ? versionCode : null }
    })
    .filter((entry): entry is PackageVersionEntry => entry !== null)
}
