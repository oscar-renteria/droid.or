import { mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PackageBackupResult } from '@shared/validation/apk-backup.schema'
import type { AdbClient } from '../adb/adb-client'
import { isValidPackageName } from '../adb/android-package-name'
import { parsePackagePaths } from '../adb/parsers/package-path-parser'

/**
 * Backs up every APK file for one package (more than one when it was
 * installed as a split/bundle — see parsePackagePaths) into
 * `<destDir>/<packageName>/`. Never throws for a single package's own
 * failure (a missing package, a failed pull) — that becomes part of the
 * result, so one bad package in a multi-package backup doesn't abort the
 * rest.
 */
export async function backupPackage(
  adbClient: AdbClient,
  serial: string,
  packageName: string,
  destDir: string
): Promise<PackageBackupResult> {
  if (!isValidPackageName(packageName)) {
    throw new Error(`Refusing to back up an invalid package name: "${packageName}"`)
  }

  let remotePaths: string[]
  try {
    const output = await adbClient.shellCommand(serial, ['pm', 'path', packageName])
    remotePaths = parsePackagePaths(output)
  } catch (error) {
    return {
      packageName,
      success: false,
      files: [],
      errorMessage:
        error instanceof Error ? error.message : 'Failed to look up this app on the device.'
    }
  }

  if (remotePaths.length === 0) {
    return {
      packageName,
      success: false,
      files: [],
      errorMessage: 'No APK files were found for this package on the device.'
    }
  }

  const packageDir = join(destDir, packageName)
  await mkdir(packageDir, { recursive: true })

  const files: PackageBackupResult['files'] = []
  for (const remotePath of remotePaths) {
    const fileName = basename(remotePath)
    const localPath = join(packageDir, fileName)
    try {
      await adbClient.pullFile(serial, remotePath, localPath)
      files.push({ remotePath, fileName, success: true, errorMessage: null })
    } catch (error) {
      files.push({
        remotePath,
        fileName,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Failed to copy this file.'
      })
    }
  }

  const success = files.every((file) => file.success)
  return {
    packageName,
    success,
    files,
    errorMessage: success ? null : 'One or more files for this app failed to copy.'
  }
}

/** Sequential, never concurrent — these share the device's single USB
 *  connection, same as every other bulk action in this app. */
export async function backupPackages(
  adbClient: AdbClient,
  serial: string,
  packageNames: string[],
  destDir: string
): Promise<PackageBackupResult[]> {
  const results: PackageBackupResult[] = []
  for (const packageName of packageNames) {
    results.push(await backupPackage(adbClient, serial, packageName, destDir))
  }
  return results
}
