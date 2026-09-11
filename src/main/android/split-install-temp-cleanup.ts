import { readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SPLIT_INSTALL_TEMP_DIR_PREFIX } from './split-apk-inspector'

/** Generous on purpose: this only ever removes a directory that is both
 *  old *and* still around, meaning a prior run's own cleanup (see
 *  resolveSplitSource/cleanupSplitSource, which delete their staging
 *  directory on every normal exit path — success, failure, or thrown
 *  error) never ran for it at all. An hour is far longer than any real
 *  analyze/install session takes, so this can't race a session that's
 *  merely slow. */
const STALE_AFTER_MS = 60 * 60 * 1000

/**
 * Removes any split-install staging directory left over from a previous
 * run that never reached its own cleanup — a crash, a forced kill, or a
 * power loss mid-extraction/install. Meant to be called once, early at app
 * startup, well before any device is even connected. Best-effort and
 * silent throughout: a stale directory left behind for one more session is
 * harmless, so nothing here is allowed to fail app startup.
 */
export async function cleanupStaleSplitInstallTempDirs(): Promise<void> {
  const root = tmpdir()
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return
  }

  const now = Date.now()
  await Promise.all(
    entries
      .filter(
        (entry) => entry.isDirectory() && entry.name.startsWith(SPLIT_INSTALL_TEMP_DIR_PREFIX)
      )
      .map(async (entry) => {
        const fullPath = join(root, entry.name)
        try {
          const stats = await stat(fullPath)
          if (now - stats.mtimeMs > STALE_AFTER_MS) {
            await rm(fullPath, { recursive: true, force: true })
          }
        } catch {
          // Best-effort — permissions, a concurrent process, already
          // gone, etc. Never let one bad entry stop the rest or block
          // startup.
        }
      })
  )
}
