import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { SplitSourceKind } from '@shared/validation/split-install.schema'
import { extractZip } from '../adb/zip-extractor'
import { isValidPackageName } from '../adb/android-package-name'
import { parseApkFile, type RawApkInfo } from './apk-parser-loader'
import { fixDataUrlMimeType, resolveApkLabel } from './apk-metadata-extractor'
import { discoverApkFiles } from './split-apk-discovery'

/** Matches parseApkFile's signature — overridable so tests can inspect a
 *  synthetic split set without needing real APK-formatted binary content
 *  (the same reason inspectLocalApk accepts a `parseApk` override). */
export type ParseApkFn = (filePath: string) => Promise<RawApkInfo>

const SUPPORTED_ARCHIVE_EXTENSIONS = ['.apks', '.xapk', '.apkm']

/** Shared with split-install-temp-cleanup.ts, which sweeps up any
 *  directory matching this prefix left behind by a run that never reached
 *  its own cleanup (a crash, a forced kill, a power loss mid-extraction). */
export const SPLIT_INSTALL_TEMP_DIR_PREFIX = 'droid-or-split-install-'

export function isSupportedSplitArchive(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return SUPPORTED_ARCHIVE_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

export interface RawSplitPart {
  filePath: string
  fileName: string
  fileSizeBytes: number
  packageName: string | null
  versionName: string | null
  versionCode: number | null
  minSdkVersion: number | null
  targetSdkVersion: number | null
  label: string | null
  iconDataUrl: string | null
  /** The manifest's own `split` attribute (RawApkInfo.split) — null on a
   *  successfully-parsed base APK (which never has one), and also null
   *  when parseError is set (nothing could be read at all). This is the
   *  authoritative signal split-apk-classifier.ts uses to classify each
   *  part; the file name is only ever consulted as a fallback when this
   *  is null because parsing failed. */
  splitAttribute: string | null
  /** Set when this file couldn't be parsed as an APK at all. Unlike
   *  inspectLocalApk (single-APK install), this never throws for one bad
   *  file — a config split that fails to parse doesn't invalidate the rest
   *  of the set, so it's kept with null metadata and this note instead. */
  parseError: string | null
}

async function inspectOnePart(filePath: string, parseApk: ParseApkFn): Promise<RawSplitPart> {
  const stats = await stat(filePath)
  const fileName = basename(filePath)

  try {
    const result = await parseApk(filePath)
    return {
      filePath,
      fileName,
      fileSizeBytes: stats.size,
      packageName: result.package && isValidPackageName(result.package) ? result.package : null,
      versionName: result.versionName ?? null,
      versionCode: result.versionCode ?? null,
      minSdkVersion: result.usesSdk?.minSdkVersion ?? null,
      targetSdkVersion: result.usesSdk?.targetSdkVersion ?? null,
      label: resolveApkLabel(result.application),
      iconDataUrl: result.icon ? fixDataUrlMimeType(result.icon) : null,
      splitAttribute: result.split ?? null,
      parseError: null
    }
  } catch (error) {
    return {
      filePath,
      fileName,
      fileSizeBytes: stats.size,
      packageName: null,
      versionName: null,
      versionCode: null,
      minSdkVersion: null,
      targetSdkVersion: null,
      label: null,
      iconDataUrl: null,
      splitAttribute: null,
      parseError: error instanceof Error ? error.message : String(error)
    }
  }
}

export interface SplitSourceResolution {
  parts: RawSplitPart[]
  /** Set only when sourceKind was 'archive' — a temp directory this
   *  resolution extracted the archive into. The caller must pass it to
   *  cleanupSplitSource once it's done reading the files it points to. */
  cleanupDir: string | null
  /** Archive entry names that existed in the source archive but weren't
   *  extracted because they weren't `.apk` files (icons, JSON metadata,
   *  OBB expansion files, etc. that .xapk/.apkm archives commonly bundle
   *  alongside the APKs). Always empty for 'directory'/'files' sources. */
  skippedNonApkEntries: string[]
}

/**
 * Resolves any of the three supported split-install sources down to a flat
 * list of individually-inspected APK files:
 *  - 'files': sourcePaths is already the full list of .apk files (e.g. a
 *    multi-select or drag-drop of an already-extracted split set).
 *  - 'directory': sourcePaths is a single folder to search for .apk files.
 *  - 'archive': sourcePaths is a single .apks/.xapk/.apkm file, extracted
 *    into a fresh app-controlled temp directory (via the same path-
 *    traversal-safe extractZip used for platform-tools downloads) before
 *    searching it the same way as 'directory'.
 *
 * Deliberately re-resolves from scratch on every call (analysis and the
 * actual install each call this independently) rather than caching a
 * result to reuse — the same "never trust a previous inspection" principle
 * inspectLocalApk/installLocalApk already follow for the single-APK flow,
 * and it avoids having to track and eventually garbage-collect a
 * server-side temp directory across separate IPC calls.
 */
export async function resolveSplitSource(
  sourceKind: SplitSourceKind,
  sourcePaths: string[],
  parseApk: ParseApkFn = parseApkFile
): Promise<SplitSourceResolution> {
  if (sourceKind === 'files') {
    const parts = await Promise.all(sourcePaths.map((path) => inspectOnePart(path, parseApk)))
    return { parts, cleanupDir: null, skippedNonApkEntries: [] }
  }

  if (sourceKind === 'directory') {
    const directory = sourcePaths[0]
    if (!directory) {
      throw new Error('No folder was provided.')
    }
    // Non-recursive by design (see discoverApkFiles) — a user-picked
    // folder is scanned flat, not walked into subfolders.
    const apkPaths = await discoverApkFiles(directory)
    if (apkPaths.length === 0) {
      throw new Error('No .apk files were found in that folder.')
    }
    const parts = await Promise.all(apkPaths.map((path) => inspectOnePart(path, parseApk)))
    return { parts, cleanupDir: null, skippedNonApkEntries: [] }
  }

  const archivePath = sourcePaths[0]
  if (!archivePath) {
    throw new Error('No archive file was provided.')
  }
  if (!isSupportedSplitArchive(archivePath)) {
    throw new Error('Only .apks, .xapk, and .apkm archives are supported.')
  }

  const stagingDir = await mkdtemp(join(tmpdir(), SPLIT_INSTALL_TEMP_DIR_PREFIX))
  try {
    // Only .apk entries are written to disk — an .xapk/.apkm archive
    // commonly also bundles an icon, JSON metadata, and/or OBB expansion
    // files this app has no use for (and no safe, existing mechanism to
    // install); skippedNonApkEntries lets the caller tell the user about
    // them instead of silently ignoring their existence.
    const { skippedEntries } = await extractZip(archivePath, stagingDir, {
      shouldExtract: (entryFileName) => entryFileName.toLowerCase().endsWith('.apk')
    })
    // Recursive: bundletool's own `.apks` output nests every split under
    // a `splits/` subfolder.
    const apkPaths = await discoverApkFiles(stagingDir, true)
    if (apkPaths.length === 0) {
      throw new Error('No .apk files were found inside that archive.')
    }
    const parts = await Promise.all(apkPaths.map((path) => inspectOnePart(path, parseApk)))
    return { parts, cleanupDir: stagingDir, skippedNonApkEntries: skippedEntries }
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true })
    throw error
  }
}

export async function cleanupSplitSource(cleanupDir: string | null): Promise<void> {
  if (cleanupDir) {
    await rm(cleanupDir, { recursive: true, force: true })
  }
}
