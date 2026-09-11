import { createWriteStream } from 'node:fs'
import { mkdir, chmod } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'

const UNIX_MODE_MASK = 0xf000
const UNIX_MODE_SYMLINK = 0xa000

/** No real archive this app extracts (platform-tools, a split APK/app
 *  bundle) is anywhere close to this size uncompressed — a generous cap
 *  against a zip-bomb-style archive claiming a much larger uncompressed
 *  size than is plausible, not a precise resource budget. */
const DEFAULT_MAX_TOTAL_UNCOMPRESSED_BYTES = 4 * 1024 * 1024 * 1024

export interface ExtractZipOptions {
  /** When given, only entries this returns true for are written to disk;
   *  everything else is skipped (directories are still created as needed
   *  for the entries that are kept). Defaults to extracting everything,
   *  preserving the original behavior for existing callers. */
  shouldExtract?: (entryFileName: string) => boolean
  /** Rejects once the cumulative uncompressed size of extracted entries
   *  would exceed this, as a coarse zip-bomb guard. */
  maxTotalUncompressedBytes?: number
}

export interface ExtractZipResult {
  /** Names of entries that existed in the archive but were not extracted
   *  because `shouldExtract` returned false for them — empty when no
   *  filter was given. Directory entries are never included here even
   *  when skipped, since they carry no content of their own. */
  skippedEntries: string[]
}

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
 *  - Two entries that would resolve to the same on-disk path are refused
 *    rather than letting the second silently overwrite the first.
 *  - The cumulative uncompressed size of everything actually written is
 *    capped, as a coarse guard against a zip-bomb-style archive (see
 *    ExtractZipOptions.maxTotalUncompressedBytes).
 *
 * (This is the exact vulnerability class an unpatched advisory exists for
 * in the popular `extract-zip` package — GHSA-jmr9-qjv8-65gv, no fix
 * available at the time this was written — which is why this uses `yauzl`
 * directly with these checks instead.)
 *
 * `shouldExtract` optionally limits which entries are actually written to
 * disk (everything else is skipped, its name reported back in
 * `skippedEntries`) — used by the split-install feature to extract only
 * the `.apk` entries out of an .apks/.xapk/.apkm archive rather than also
 * writing out icons, JSON metadata, or OBB expansion files it has no use
 * for. Omitting it (every existing caller before this option existed)
 * extracts everything, unchanged from the original behavior.
 */
export function extractZip(
  zipPath: string,
  destDir: string,
  options: ExtractZipOptions = {}
): Promise<ExtractZipResult> {
  const shouldExtract = options.shouldExtract ?? (() => true)
  const maxTotalUncompressedBytes =
    options.maxTotalUncompressedBytes ?? DEFAULT_MAX_TOTAL_UNCOMPRESSED_BYTES

  return new Promise((resolvePromise, reject) => {
    const seenTargetPaths = new Set<string>()
    const skippedEntries: string[] = []
    let totalUncompressedBytes = 0

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

        if (!isDirectory && !shouldExtract(entry.fileName)) {
          skippedEntries.push(entry.fileName)
          zipfile.readEntry()
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

        if (seenTargetPaths.has(targetPath)) {
          reject(
            new Error(
              `Refusing to extract a duplicate entry: two entries resolve to "${targetPath}"`
            )
          )
          return
        }
        seenTargetPaths.add(targetPath)

        totalUncompressedBytes += entry.uncompressedSize
        if (totalUncompressedBytes > maxTotalUncompressedBytes) {
          reject(new Error('Refusing to extract: this archive is larger than expected.'))
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

      zipfile.on('end', () => resolvePromise({ skippedEntries }))
      zipfile.readEntry()
    })
  })
}
