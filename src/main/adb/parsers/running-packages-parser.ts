/**
 * Parses `dumpsys activity processes` for the set of currently-running
 * package names. Verified against a real device: every process record
 * includes a `packageList={pkg1,pkg2}` line (a process can host more than
 * one package under a shared UID), which is all this needs — the rest of
 * that dump (process state, memory, provider/service details) is far more
 * than "is this package running right now" requires.
 */
export function parseRunningPackages(output: string): Set<string> {
  const running = new Set<string>()
  const pattern = /packageList=\{([^}]*)\}/g

  for (const match of output.matchAll(pattern)) {
    const names = match[1]
    if (!names) {
      continue
    }
    for (const name of names.split(',')) {
      const trimmed = name.trim()
      if (trimmed) {
        running.add(trimmed)
      }
    }
  }

  return running
}
