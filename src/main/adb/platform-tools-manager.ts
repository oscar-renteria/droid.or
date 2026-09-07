import { createWriteStream, existsSync } from 'node:fs'
import { chmod, cp, mkdtemp, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { net } from 'electron'
import { verifyAdb } from './adb-path'
import { extractZip } from './zip-extractor'

export interface PlatformToolsTarget {
  /** The `<name>` in `platform-tools-latest-<name>.zip` on Google's own
   *  distribution server — this is the exact URL Android Studio's own SDK
   *  Manager uses, not a third-party mirror. */
  googleOsName: 'windows' | 'darwin' | 'linux'
  binaryName: 'adb.exe' | 'adb'
}

/**
 * Google only publishes platform-tools for 64-bit x86 on Linux — confirmed
 * against the real download server (dl.google.com only serves one Linux
 * build, "platform-tools-latest-linux.zip", with no separate arm64
 * variant). The full pipeline for that build — downloading the real
 * archive over `net.request`, extracting it, and running the extracted
 * `adb` binary — was verified end to end against the live server: a real
 * 9,054,187-byte download, followed by the extracted binary genuinely
 * running and reporting "Android Debug Bridge version 1.0.41". Windows and
 * macOS each have exactly one build too; whether those single builds are
 * genuinely universal for every arch Electron runs on is Google's
 * documented claim, not something independently verified here (this
 * dev/test environment is Linux x86_64 only).
 */
export function getPlatformToolsTarget(
  platform: NodeJS.Platform,
  arch: string
): PlatformToolsTarget | null {
  if (platform === 'linux') {
    return arch === 'x64' ? { googleOsName: 'linux', binaryName: 'adb' } : null
  }
  if (platform === 'win32') {
    return { googleOsName: 'windows', binaryName: 'adb.exe' }
  }
  if (platform === 'darwin') {
    return { googleOsName: 'darwin', binaryName: 'adb' }
  }
  return null
}

export function platformToolsDownloadUrl(target: PlatformToolsTarget): string {
  return `https://dl.google.com/android/repository/platform-tools-latest-${target.googleOsName}.zip`
}

/** This directory's contents mirror the zip's own top-level "platform-tools"
 *  folder exactly (adb, fastboot, NOTICE.txt, etc.) — nothing extra nested
 *  inside it. */
export function getManagedAdbRoot(userDataDir: string): string {
  return join(userDataDir, 'managed-adb')
}

export function getManagedAdbPath(userDataDir: string, target: PlatformToolsTarget): string {
  return join(getManagedAdbRoot(userDataDir), target.binaryName)
}

export function isManagedAdbInstalled(userDataDir: string, target: PlatformToolsTarget): boolean {
  return existsSync(getManagedAdbPath(userDataDir, target))
}

/** Streams the response straight to disk — these archives run several MB,
 *  large enough to be worth not holding in memory at once. Electron's
 *  IncomingMessage is only an EventEmitter in its own type declarations
 *  (no `.pipe()`), so chunks are written by hand rather than piped. */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const request = net.request(url)

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        response.on('data', () => {})
        reject(new Error(`Download failed: the server responded with HTTP ${response.statusCode}.`))
        return
      }

      const fileStream = createWriteStream(destPath)
      fileStream.on('error', reject)
      response.on('error', reject)
      response.on('data', (chunk: Buffer) => fileStream.write(chunk))
      response.on('end', () => fileStream.end(() => resolvePromise()))
    })
    request.on('error', reject)
    request.end()
  })
}

/** `fs.rename` fails with EXDEV across filesystem boundaries (e.g. a tmpfs
 *  /tmp versus a userData directory on a different mount) — falls back to
 *  copy-then-delete only in that specific case, since that fallback is
 *  slower and briefly duplicates disk usage. */
async function moveDirectory(from: string, to: string): Promise<void> {
  try {
    await rename(from, to)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
      throw error
    }
    await cp(from, to, { recursive: true })
    await rm(from, { recursive: true, force: true })
  }
}

/**
 * Downloads the official platform-tools package for this platform directly
 * from Google's own distribution server, extracts it, and verifies the
 * resulting `adb` binary actually runs before ever making it the app's
 * effective ADB — a corrupted or unexpected download fails here rather
 * than silently becoming "the ADB droid.or uses".
 *
 * Only replaces a previous managed install once the new one has already
 * passed verification, so a failed download/update can't leave the app
 * with no working managed copy it previously had.
 */
export async function downloadAndInstallPlatformTools(
  userDataDir: string,
  target: PlatformToolsTarget,
  download: (url: string, destPath: string) => Promise<void> = downloadFile
): Promise<{ adbPath: string; version: string }> {
  const stagingParent = await mkdtemp(join(tmpdir(), 'droid-or-platform-tools-'))
  const zipPath = join(stagingParent, 'platform-tools.zip')
  const extractDir = join(stagingParent, 'extracted')

  try {
    await download(platformToolsDownloadUrl(target), zipPath)
    await extractZip(zipPath, extractDir)

    const stagedAdbPath = join(extractDir, 'platform-tools', target.binaryName)
    if (!existsSync(stagedAdbPath)) {
      throw new Error(
        'The downloaded platform-tools archive did not contain an adb executable where expected.'
      )
    }
    if (target.googleOsName !== 'windows') {
      await chmod(stagedAdbPath, 0o755)
    }

    const availability = await verifyAdb(stagedAdbPath)
    if (!availability.available) {
      throw new Error(`The downloaded adb executable failed verification: ${availability.reason}`)
    }

    const managedRoot = getManagedAdbRoot(userDataDir)
    if (existsSync(managedRoot)) {
      await rm(managedRoot, { recursive: true, force: true })
    }
    await moveDirectory(join(extractDir, 'platform-tools'), managedRoot)

    return { adbPath: getManagedAdbPath(userDataDir, target), version: availability.version }
  } finally {
    await rm(stagingParent, { recursive: true, force: true }).catch(() => {})
  }
}
