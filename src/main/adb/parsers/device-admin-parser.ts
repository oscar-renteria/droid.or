/**
 * Parses the "Enabled Device Admins" section of `dumpsys device_policy`.
 * Verified against a real device: each admin appears as a four-space-
 * indented "<package>/<component>:" line directly under that section's
 * own header, followed by many more-deeply-indented detail lines (policy
 * flags, password requirements, etc.) that don't match this shape. The
 * section is extracted first, up to the next top-level (two-space-indent)
 * heading, so a similarly-shaped line in an unrelated section on a
 * different Android version/OEM build can't be picked up by accident.
 */
export function parseDeviceAdminPackages(output: string): string[] {
  const sectionStart = output.indexOf('Enabled Device Admins')
  if (sectionStart === -1) {
    return []
  }

  const afterHeader = output.slice(sectionStart)
  const nextHeadingMatch = /\n {2}\S/.exec(afterHeader.slice(1))
  const section = nextHeadingMatch ? afterHeader.slice(0, nextHeadingMatch.index + 1) : afterHeader

  const packages = new Set<string>()
  const pattern = /^ {4}([a-zA-Z][\w.]*)\/\S+:[ \t]*$/gm
  for (const match of section.matchAll(pattern)) {
    const packageName = match[1]
    if (packageName) {
      packages.add(packageName)
    }
  }
  return [...packages]
}
