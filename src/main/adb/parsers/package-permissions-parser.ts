function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parses `dumpsys package <name>`'s "requested permissions:" list for one
 * package. Verified against two real devices: the dump repeats a
 * "  Package [name] (hash):" header once per shared-UID sibling in some
 * cases (seen twice for the same package on both devices tested), each
 * followed by a "    requested permissions:" section listing one
 * permission per line at 6-space indent, up to the next 4-space-indented
 * section ("install permissions:" on both devices, sometimes preceded by
 * a "declared permissions:" section at the same indent before it — the
 * boundary detection only cares about indent level, not the heading text,
 * so that doesn't matter). Only the first "Package [name]" section is
 * used; later ones are the same package's shared-UID sibling, not
 * additional information about the package itself.
 */
export function parsePackageRequestedPermissions(output: string, packageName: string): string[] {
  const headerPattern = new RegExp(
    `^ {2}Package \\[${escapeRegExp(packageName)}\\] \\([0-9a-f]+\\):$`,
    'm'
  )
  const headerMatch = headerPattern.exec(output)
  if (!headerMatch) {
    return []
  }
  const afterHeader = output.slice(headerMatch.index + headerMatch[0].length)

  const sectionMarker = 'requested permissions:'
  const sectionStart = afterHeader.indexOf(sectionMarker)
  if (sectionStart === -1) {
    return []
  }
  const afterSectionHeader = afterHeader.slice(sectionStart + sectionMarker.length)
  const nextHeadingMatch = /\n {4}\S/.exec(afterSectionHeader)
  const section = nextHeadingMatch
    ? afterSectionHeader.slice(0, nextHeadingMatch.index)
    : afterSectionHeader

  const permissions: string[] = []
  for (const line of section.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    // A permission line is occasionally suffixed, e.g.
    // "android.permission.WRITE_EXTERNAL_STORAGE: restricted=true" — only
    // the bare permission name is useful context for an AI prompt.
    const name = trimmed.split(':')[0]?.trim()
    if (name) {
      permissions.push(name)
    }
  }
  return permissions
}
