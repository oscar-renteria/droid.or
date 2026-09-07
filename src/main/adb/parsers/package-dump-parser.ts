export interface PackageDumpEntry {
  versionCode: number | null
  versionName: string | null
  firstInstallTimeMs: number | null
  lastUpdateTimeMs: number | null
}

function parseTimestamp(raw: string | undefined): number | null {
  if (!raw) {
    return null
  }
  const parsed = new Date(raw.trim()).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Parses `dumpsys package packages` (no package name argument dumps every
 * package in one call — far faster than one dumpsys call per package on a
 * device with hundreds of them). Sections are split on the
 * "  Package [name] (hash):" header line; verified against a real 595-package
 * device that this exact two-space-indented format is stable and that
 * "flags=[...]" / "privateFlags=[...]" lines don't collide with each other's
 * regex, though this field isn't used here.
 */
export function parsePackageDump(output: string): Map<string, PackageDumpEntry> {
  const result = new Map<string, PackageDumpEntry>()
  const sectionHeaderPattern = /^ {2}Package \[([^\]]+)\] \([0-9a-f]+\):$/gm
  const headers = [...output.matchAll(sectionHeaderPattern)]

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    if (!header?.[1] || header.index === undefined) {
      continue
    }
    const packageName = header[1]
    const sectionStart = header.index + header[0].length
    const sectionEnd = headers[i + 1]?.index ?? output.length
    const section = output.slice(sectionStart, sectionEnd)

    const versionCodeMatch = /versionCode=(\d+)/.exec(section)
    const versionNameMatch = /versionName=(.+)/.exec(section)
    const firstInstallMatch = /firstInstallTime=(.+)/.exec(section)
    const lastUpdateMatch = /lastUpdateTime=(.+)/.exec(section)

    result.set(packageName, {
      versionCode: versionCodeMatch?.[1] ? Number.parseInt(versionCodeMatch[1], 10) : null,
      versionName: versionNameMatch?.[1]?.trim() ?? null,
      firstInstallTimeMs: parseTimestamp(firstInstallMatch?.[1]),
      lastUpdateTimeMs: parseTimestamp(lastUpdateMatch?.[1])
    })
  }

  return result
}
