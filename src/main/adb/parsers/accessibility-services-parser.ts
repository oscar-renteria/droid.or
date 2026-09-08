/**
 * Parses `settings get secure enabled_accessibility_services` — the
 * standard Android Settings.Secure key, a colon-separated list of
 * "<package>/<component>" ComponentName strings. Verified against a real
 * device with two services enabled. The device reports the literal string
 * "null" (not empty output) when nothing is enabled, same as any other
 * unset Settings.Secure key.
 */
export function parseAccessibilityServicePackages(output: string): string[] {
  const trimmed = output.trim()
  if (trimmed.length === 0 || trimmed === 'null') {
    return []
  }

  const packages = new Set<string>()
  for (const entry of trimmed.split(':')) {
    const slashIndex = entry.indexOf('/')
    const packageName = slashIndex === -1 ? entry : entry.slice(0, slashIndex)
    if (packageName) {
      packages.add(packageName)
    }
  }
  return [...packages]
}
