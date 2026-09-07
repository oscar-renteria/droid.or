import { createWriteStream } from 'node:fs'
import { mkdir, chmod } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'

const UNIX_MODE_MASK = 0xf000
const UNIX_MODE_SYMLINK = 0xa000

/**
 * Resolves one zip entry's name against destDir and throws if the result
 * would land outside it — the "zip-slip" check, isolated as its own pure
 * function so it can be tested directly against a crafted entry name
 * without needing a zip file that actually contains one (most zip writers,
 * yazl included, refuse to construct a traversal entry in the first place,
 * which is correct of them but makes the vulnerable case hard to reach
 * from the writing side for a test).
 */
export function resolveSafeEntryPath(destDir: string, entryFileName: string): string {
  const destRoot = resolve(destDir)
  const targetPath = resolve(destRoot, entryFileName)
  if (targetPath !== destRoot && !targetPath.startsWith(destRoot + sep)) {
    throw new Error(`Refusing to extract entry outside the target directory: "${entryFileName}"`)
  }
  return targetPath
}

/**
 * Extracts a zip file into destDir, refusing anything a malicious archive
 * could use to write outside of it. Two protections, both deliberate:
 *
 *  - Every entry's resolved output path must stay strictly inside destDir
 *    ("zip-slip" — a "../../etc/passwd"-style entry name is rejected).
 *  - Symlink entries are refused outright rather than followed or
 *    recreated, since Google's platform-tools archive is a flat set of
 *    regular files and has no legitimate reason to contain one.
 *
 * (This is the exact vulnerability class an unpatched advisory exists for
 * in the popular `extract-zip` package — GHSA-jmr9-qjv8-65gv, no fix
 * available at the time this was written — which is why this uses `yauzl`
 * directly with these checks instead.)
 */
export function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipfile) => {
      if (openError || !zipfile) {
        reject(openError ?? new Error('Failed to open the downloaded archive.'))
        return
      }

      zipfile.on('error', reject)

      zipfile.on('entry', (entry: yauzl.Entry) => {
        const isDirectory = entry.fileName.endsWith('/')
        const unixMode = (entry.externalFileAttributes >>> 16) & UNIX_MODE_MASK
        if (unixMode === UNIX_MODE_SYMLINK) {
          reject(new Error(`Refusing to extract a symlink entry: "${entry.fileName}"`))
          return
        }

        let targetPath: string
        try {
          targetPath = resolveSafeEntryPath(destDir, entry.fileName)
        } catch (error) {
          reject(error)
          return
        }

        if (isDirectory) {
          mkdir(targetPath, { recursive: true })
            .then(() => zipfile.readEntry())
            .catch(reject)
          return
        }

        zipfile.openReadStream(entry, (streamError, readStream) => {
          if (streamError || !readStream) {
            reject(streamError ?? new Error(`Failed to read entry "${entry.fileName}"`))
            return
          }

          mkdir(dirname(targetPath), { recursive: true })
            .then(() => pipeline(readStream, createWriteStream(targetPath)))
            .then(() => {
              // Restores the executable bit for Unix binaries, which a
              // plain stream copy doesn't preserve. The caller is
              // responsible for re-asserting it on the specific adb
              // binary too, in case the archive didn't record it.
              const mode = (entry.externalFileAttributes >>> 16) & 0o777
              return mode ? chmod(targetPath, mode) : undefined
            })
            .then(() => zipfile.readEntry())
            .catch(reject)
        })
      })

      zipfile.on('end', () => resolvePromise())
      zipfile.readEntry()
    })
  })
}
