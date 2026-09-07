import type Database from 'better-sqlite3'
import type { InstallPlan } from '@shared/validation/apk-install.schema'
import type { OperationResult } from '@shared/validation/operation.schema'
import type { AdbClient } from '../adb/adb-client'
import { isValidPackageName } from '../adb/android-package-name'
import { extractInstallFailureMessage, isInstallSuccessful } from '../adb/install-result-parser'
import { parsePackageVersionCodeList } from '../adb/parsers/package-versioncode-parser'
import { recordOperation } from '../persistence/operation-history.repository'
import type { LocalApkInfo } from './local-apk-inspector'

/** Exact-match against the same substring-matching pitfall every other
 *  `pm list packages <filter>` call in this app already accounts for. */
async function getInstalledVersionCode(
  adbClient: AdbClient,
  serial: string,
  packageName: string
): Promise<number | null> {
  const output = await adbClient.shellCommand(serial, [
    'pm',
    'list',
    'packages',
    '--show-versioncode',
    packageName
  ])
  const entry = parsePackageVersionCodeList(output).find((e) => e.packageName === packageName)
  return entry?.versionCode ?? null
}

/**
 * Determines what installing this specific local APK would actually do,
 * purely informational (the install command itself is always the same
 * `-r` install regardless of which of these applies — see
 * AdbClient.installApk) so the user can see it before confirming rather
 * than being surprised by it after the fact.
 */
export async function getInstallPlan(
  adbClient: AdbClient,
  serial: string,
  localApk: LocalApkInfo
): Promise<InstallPlan> {
  const currentVersionCode = await getInstalledVersionCode(adbClient, serial, localApk.packageName)

  if (currentVersionCode === null) {
    return { operation: 'fresh-install', currentVersionCode: null }
  }
  if (localApk.versionCode === null || localApk.versionCode > currentVersionCode) {
    return { operation: 'update', currentVersionCode }
  }
  if (localApk.versionCode === currentVersionCode) {
    return { operation: 'reinstall-same-version', currentVersionCode }
  }
  return { operation: 'downgrade-attempt', currentVersionCode }
}

function describeInstallSuccess(operation: InstallPlan['operation']): string {
  switch (operation) {
    case 'fresh-install':
      return 'App installed.'
    case 'update':
      return 'App updated.'
    case 'reinstall-same-version':
      return 'App reinstalled (same version).'
    case 'downgrade-attempt':
      return 'App installed at an older version.'
  }
}

/**
 * Installs a local APK and records the outcome to history, following the
 * same "never trust a zero exit code alone" rule as every other mutating
 * action in this app: after adb reports success, the device's installed
 * version code is independently re-queried and compared against what was
 * just installed, rather than assuming adb's own report is accurate.
 */
export async function installLocalApk(
  db: Database.Database,
  adbClient: AdbClient,
  serial: string,
  localApk: LocalApkInfo
): Promise<OperationResult> {
  if (!isValidPackageName(localApk.packageName)) {
    throw new Error(
      `Refusing to install a file with an invalid package name: "${localApk.packageName}"`
    )
  }

  const plan = await getInstallPlan(adbClient, serial, localApk)
  const mutation = await adbClient.installApk(serial, localApk.filePath)
  const rawOutput = [mutation.stdout, mutation.stderr].filter(Boolean).join('\n').trim()

  let success: boolean
  let message: string
  let newVersionCode: number | null = null

  if (!isInstallSuccessful(mutation.exitCode, mutation.stdout)) {
    success = false
    message = extractInstallFailureMessage(mutation.stdout, mutation.stderr)
  } else {
    newVersionCode = await getInstalledVersionCode(adbClient, serial, localApk.packageName)
    success = newVersionCode !== null
    message = success
      ? describeInstallSuccess(plan.operation)
      : "adb reported success, but the app doesn't appear to be installed."
  }

  recordOperation(db, {
    deviceId: serial,
    packageName: localApk.packageName,
    operation: 'install',
    previousState:
      plan.currentVersionCode !== null
        ? `version code ${plan.currentVersionCode}`
        : 'not installed',
    newState: newVersionCode !== null ? `version code ${newVersionCode}` : null,
    success,
    rawOutput: rawOutput || '(no output)'
  })

  return { success, message, rawOutput: rawOutput || '(no output)' }
}
