import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Bounds recursive descent into an extracted archive so a pathological
 *  (or malicious) archive with deeply nested directories can't cause
 *  runaway recursion — no real bundletool/xapk/apkm output nests more than
 *  one or two levels deep. */
const MAX_DISCOVERY_DEPTH = 6

/**
 * Finds `.apk` files under rootDir. `recursive` defaults to false, per the
 * spec's explicit "default to non-recursive directory scanning" guidance
 * for a user-picked folder (this app has no prior directory-scanning
 * convention to defer to instead) — a flat folder of split APKs is the
 * common case, and non-recursive keeps behavior predictable (a stray .apk
 * in an unrelated subfolder isn't silently swept in). Callers that already
 * know their input nests output in subdirectories (an extracted archive's
 * staging directory — bundletool's own `.apks` output nests everything
 * under a `splits/` subfolder) pass `recursive: true` explicitly. Returned
 * paths are sorted for deterministic, reproducible output across runs.
 */
export async function discoverApkFiles(
  rootDir: string,
  recursive = false,
  depth = 0
): Promise<string[]> {
  if (depth > MAX_DISCOVERY_DEPTH) {
    return []
  }

  const entries = await readdir(rootDir, { withFileTypes: true })
  const results: string[] = []

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      if (recursive) {
        results.push(...(await discoverApkFiles(fullPath, recursive, depth + 1)))
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.apk')) {
      results.push(fullPath)
    }
  }

  return results.sort((a, b) => a.localeCompare(b))
}
