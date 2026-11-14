import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, posix } from 'node:path'
import type Database from 'better-sqlite3'
import type { OperationResult } from '@shared/validation/operation.schema'
import type { SplitInstallAnalysis } from '@shared/validation/split-install.schema'
import type { DeviceTransferPackage } from '@shared/types/device-transfer'
import type { DeviceTransferProgressUpdate } from '@shared/validation/device-transfer.schema'
import type { AdbClient } from '../adb/adb-client'
import { isValidPackageName } from '../adb/android-package-name'
import { parsePackageDump } from '../adb/parsers/package-dump-parser'
import { parsePackagePaths } from '../adb/parsers/package-path-parser'
import { parsePackageNameList } from '../adb/parsers/package-list-parser'
import { KNOWN_PACKAGE_NAMES } from './known-package-names'
import { SPLIT_INSTALL_TEMP_DIR_PREFIX, type ParseApkFn } from './split-apk-inspector'
import { buildSplitInstallAnalysis, performSplitInstall } from './split-install.service'

export async function getDeviceTransferPackages(
  adbClient: AdbClient,
  sourceSerial: string
): Promise<DeviceTransferPackage[]> {
  const [packageListOutput, packageDumpOutput] = await Promise.all([
    adbClient.shellCommand(sourceSerial, ['pm', 'list', 'packages', '-3']),
    adbClient.shellCommand(sourceSerial, ['dumpsys', 'package', 'packages'])
  ])
  const packageDetails = parsePackageDump(packageDumpOutput)

  return parsePackageNameList(packageListOutput).map((packageName) => {
    const details = packageDetails.get(packageName)
    return {
      packageName,
      displayName: KNOWN_PACKAGE_NAMES.get(packageName) ?? null,
      versionName: details?.versionName ?? null,
      versionCode: details?.versionCode ?? null
    }
  })
}

/** Adopted storage (an SD card formatted as internal storage) moves user
 *  apps to /mnt/expand/<volume-uuid>/app/ instead of /data/app/. */
const ADOPTED_STORAGE_APP_DIR = /^\/mnt\/expand\/[^/]+\/app\//

/**
 * Only apps installed into user storage can be copied. A preinstalled
 * system/product-partition app (e.g. Gmail under /product/app/) is a
 * vendor build for that specific device — installing it onto another one
 * can fail or conflict with that device's own copy. Normalized first so a
 * `..` segment can't sneak an out-of-tree path past the prefix check.
 */
export function isUserStorageApkPath(remotePath: string): boolean {
  const normalized = posix.normalize(remotePath)
  return normalized.startsWith('/data/app/') || ADOPTED_STORAGE_APP_DIR.test(normalized)
}

/**
 * Pulls every APK file the source device has for one package (the base
 * plus each split, see parsePackagePaths) into a fresh staging directory.
 * The directory uses the split installer's temp prefix so the startup
 * sweep (split-install-temp-cleanup.ts) also covers a crash mid-transfer.
 * The caller owns the returned directory and must remove it.
 */
export async function stagePackageFromDevice(
  adbClient: AdbClient,
  sourceSerial: string,
  packageName: string,
  onProgress?: (progress: DeviceTransferProgressUpdate) => void
): Promise<string> {
  if (!isValidPackageName(packageName)) {
    throw new Error(`Refusing to copy an invalid package name: "${packageName}"`)
  }

  const output = await adbClient.shellCommand(sourceSerial, ['pm', 'path', packageName])
  const remotePaths = parsePackagePaths(output)
  if (remotePaths.length === 0) {
    throw new Error('This app is not installed on the source device.')
  }
  if (!remotePaths.every(isUserStorageApkPath)) {
    throw new Error(
      'Only apps installed in user storage can be copied — this one is preinstalled on the source device.'
    )
  }
  const fileNames = remotePaths.map((remotePath) => basename(remotePath))
  if (new Set(fileNames).size !== fileNames.length) {
    throw new Error('The source device reported two APK files with the same name.')
  }

  const stagingDir = await mkdtemp(join(tmpdir(), SPLIT_INSTALL_TEMP_DIR_PREFIX))
  try {
    for (const [index, remotePath] of remotePaths.entries()) {
      onProgress?.({
        phase: 'pulling',
        fileName: basename(remotePath),
        fileNumber: index + 1,
        totalFiles: remotePaths.length
      })
      await adbClient.pullFile(sourceSerial, remotePath, join(stagingDir, basename(remotePath)))
    }
    return stagingDir
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true })
    throw error
  }
}

function assertDistinctDevices(sourceSerial: string, targetSerial: string): void {
  if (sourceSerial === targetSerial) {
    throw new Error('The source and target device must be different.')
  }
}

/**
 * Read-only for both devices: pulls the app from the source and reports
 * what installing that exact file set would do on the target. Nothing is
 * kept afterwards — performDeviceTransfer pulls again from scratch.
 */
export async function analyzeDeviceTransfer(
  adbClient: AdbClient,
  sourceSerial: string,
  targetSerial: string,
  packageName: string,
  parseApk?: ParseApkFn,
  onProgress?: (progress: DeviceTransferProgressUpdate) => void
): Promise<SplitInstallAnalysis> {
  assertDistinctDevices(sourceSerial, targetSerial)
  const stagingDir = await stagePackageFromDevice(adbClient, sourceSerial, packageName, onProgress)
  try {
    onProgress?.({ phase: 'checking' })
    return await buildSplitInstallAnalysis(
      adbClient,
      targetSerial,
      'directory',
      [stagingDir],
      parseApk
    )
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }
}

/**
 * Pulls the app from the source again, re-checks the fresh copy against the
 * target, and installs every pulled file there. Every file is installed —
 * never a subset: the source already holds only the splits Play delivered
 * to it, and dropping one (e.g. a density split that doesn't match the
 * target's screen) fails with INSTALL_FAILED_MISSING_SPLIT on a base that
 * declares its splits required. `expectedVersionCode` is the version the
 * user reviewed; if the source updated the app in between, this refuses
 * instead of installing something the user never saw.
 */
export async function performDeviceTransfer(
  db: Database.Database,
  adbClient: AdbClient,
  sourceSerial: string,
  targetSerial: string,
  packageName: string,
  expectedVersionCode: number | null,
  historyNote: string,
  parseApk?: ParseApkFn,
  onProgress?: (progress: DeviceTransferProgressUpdate) => void
): Promise<OperationResult> {
  assertDistinctDevices(sourceSerial, targetSerial)
  const stagingDir = await stagePackageFromDevice(adbClient, sourceSerial, packageName, onProgress)
  try {
    onProgress?.({ phase: 'checking' })
    const analysis = await buildSplitInstallAnalysis(
      adbClient,
      targetSerial,
      'directory',
      [stagingDir],
      parseApk
    )
    if (analysis.packageName !== packageName) {
      throw new Error(
        `The files pulled from the source device belong to "${analysis.packageName ?? 'an unknown package'}", not "${packageName}".`
      )
    }
    // A null on either side would make this check pass without guarding
    // anything, so an unreadable version code is refused too.
    if (
      expectedVersionCode === null ||
      analysis.versionCode === null ||
      analysis.versionCode !== expectedVersionCode
    ) {
      throw new Error(
        "Couldn't confirm that the app on the source device is still the version that was checked (it may have been updated) — check compatibility again."
      )
    }
    if (!analysis.canInstall) {
      throw new Error(
        analysis.issues.find((issue) => issue.severity === 'error')?.message ??
          'This app cannot be installed on the target device.'
      )
    }

    return await performSplitInstall(
      db,
      adbClient,
      targetSerial,
      'directory',
      [stagingDir],
      analysis.parts.map((part) => part.fileName),
      parseApk,
      historyNote,
      () => onProgress?.({ phase: 'installing', fileCount: analysis.parts.length })
    )
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }
}
