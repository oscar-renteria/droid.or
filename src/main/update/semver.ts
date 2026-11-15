const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

interface ParsedVersion {
  core: [number, number, number]
  prerelease: string[]
}

export function parseVersion(raw: string): ParsedVersion | null {
  const match = SEMVER_PATTERN.exec(raw.trim().replace(/^v/, ''))
  if (!match) {
    return null
  }
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : []
  }
}

function compareIdentifiers(a: string, b: string): number {
  const aNumeric = /^\d+$/.test(a)
  const bNumeric = /^\d+$/.test(b)
  if (aNumeric && bNumeric) {
    return Math.sign(Number(a) - Number(b))
  }
  // SemVer §11: numeric identifiers sort before alphanumeric ones.
  if (aNumeric !== bNumeric) {
    return aNumeric ? -1 : 1
  }
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * SemVer 2.0 precedence: negative if `a` < `b`, 0 if equal, positive if
 * `a` > `b`. A prerelease sorts before its release (1.0.0-beta.1 < 1.0.0).
 * Throws on anything that isn't a version, so a malformed tag can never
 * be mistaken for an update.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) {
    throw new Error(`Not a SemVer version: "${left ? b : a}"`)
  }
  for (let i = 0; i < 3; i++) {
    const diff = left.core[i]! - right.core[i]!
    if (diff !== 0) {
      return Math.sign(diff)
    }
  }
  const leftIsRelease = left.prerelease.length === 0
  const rightIsRelease = right.prerelease.length === 0
  if (leftIsRelease || rightIsRelease) {
    return leftIsRelease === rightIsRelease ? 0 : leftIsRelease ? 1 : -1
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length)
  for (let i = 0; i < length; i++) {
    const l = left.prerelease[i]
    const r = right.prerelease[i]
    if (l === undefined) return -1
    if (r === undefined) return 1
    const diff = compareIdentifiers(l, r)
    if (diff !== 0) return diff
  }
  return 0
}
