import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { isValidPackageName } from '../adb/android-package-name'
import { parseApkFile, type RawApkInfo } from './apk-parser-loader'
import { fixDataUrlMimeType, resolveApkLabel } from './apk-metadata-extractor'

export interface LocalApkInfo {
  filePath: string
  fileName: string
  fileSizeBytes: number
  packageName: string
  versionName: string | null
  versionCode: number | null
  minSdkVersion: number | null
  targetSdkVersion: number | null
  label: string | null
  iconDataUrl: string | null
}

/**
 * Parses a local .apk file the user picked or dropped, for the info the
 * spec asks to show before installation. Unlike extractApkMetadata (used
 * for already-installed apps, where a parse failure just means "no icon"),
 * this throws on failure — there is no reasonable way to offer to install
 * a file whose package name couldn't even be determined, so the caller
 * needs an explicit, per-file error rather than a silently degraded
 * result.
 */
export async function inspectLocalApk(
  filePath: string,
  parseApk: (path: string) => Promise<RawApkInfo> = parseApkFile
): Promise<LocalApkInfo> {
  if (!filePath.toLowerCase().endsWith('.apk')) {
    throw new Error('Only .apk files are supported.')
  }

  const stats = await stat(filePath)

  let result: RawApkInfo
  try {
    result = await parseApk(filePath)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`This file couldn't be read as an APK: ${reason}`, { cause: error })
  }

  if (!result.package || !isValidPackageName(result.package)) {
    throw new Error("This file doesn't look like a valid APK (no usable package name found).")
  }

  return {
    filePath,
    fileName: basename(filePath),
    fileSizeBytes: stats.size,
    packageName: result.package,
    versionName: result.versionName ?? null,
    versionCode: result.versionCode ?? null,
    minSdkVersion: result.usesSdk?.minSdkVersion ?? null,
    targetSdkVersion: result.usesSdk?.targetSdkVersion ?? null,
    label: resolveApkLabel(result.application),
    iconDataUrl: result.icon ? fixDataUrlMimeType(result.icon) : null
  }
}
