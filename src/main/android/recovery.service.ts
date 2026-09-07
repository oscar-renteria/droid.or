import type Database from 'better-sqlite3'
import type {
  ClearedPackageChange,
  DeviceChanges,
  RestorablePackageChange
} from '@shared/validation/recovery.schema'
import type { AdbClient } from '../adb/adb-client'
import { isPackageDisabled, isPackageInstalledForUser } from './package-operations.service'
import { parsePackageNameList } from '../adb/parsers/package-list-parser'
import { getLatestSuccessfulOperationPerPackage } from '../persistence/operation-history.repository'

const NOT_REINSTALLABLE_REASON =
  "This app was completely removed from the device — its installer is no longer present, so it can't be reinstalled automatically here. Reinstall it from the Play Store or its original source if you need it back."

/** `-u` also includes packages currently uninstalled for a user — verified
 *  against a real device's own `pm list packages` help text. A package
 *  still appearing here (even though hidden from the plain, unfiltered
 *  list) still has its APK on the device and can be restored with
 *  `pm install-existing`; one that doesn't appear at all is genuinely
 *  gone. */
async function isKnownToPackageManager(
  adbClient: AdbClient,
  serial: string,
  packageName: string
): Promise<boolean> {
  const output = await adbClient.shellCommand(serial, ['pm', 'list', 'packages', '-u', packageName])
  return parsePackageNameList(output).includes(packageName)
}

/**
 * What this app has changed on a device and is still in effect right now.
 * Folds the operation history down to one, most-recent *successful* entry
 * per package, then re-verifies each one against the device's live state —
 * a package this app disabled but that has since been re-enabled (by the
 * user, from Settings, or anything else outside this app) correctly drops
 * out rather than being offered for restore.
 */
export async function getDeviceChanges(
  db: Database.Database,
  adbClient: AdbClient,
  serial: string
): Promise<DeviceChanges> {
  const latest = getLatestSuccessfulOperationPerPackage(db, serial)

  const disabled: RestorablePackageChange[] = []
  const uninstalled: RestorablePackageChange[] = []
  const cleared: ClearedPackageChange[] = []

  for (const entry of latest) {
    if (entry.operation === 'disable') {
      const stillDisabled = await isPackageDisabled(adbClient, serial, entry.packageName)
      if (stillDisabled) {
        disabled.push({
          packageName: entry.packageName,
          operation: 'disable',
          performedAt: entry.performedAt,
          restorable: true,
          blockedReason: null
        })
      }
    } else if (entry.operation === 'uninstall-for-user') {
      const stillUninstalled = !(await isPackageInstalledForUser(
        adbClient,
        serial,
        entry.packageName
      ))
      if (stillUninstalled) {
        const known = await isKnownToPackageManager(adbClient, serial, entry.packageName)
        uninstalled.push({
          packageName: entry.packageName,
          operation: 'uninstall-for-user',
          performedAt: entry.performedAt,
          restorable: known,
          blockedReason: known ? null : NOT_REINSTALLABLE_REASON
        })
      }
    } else if (entry.operation === 'clear-data') {
      cleared.push({ packageName: entry.packageName, performedAt: entry.performedAt })
    }
    // 'enable' and 'restore-install' mean the package is already back to
    // its original state — nothing to list.
  }

  return { deviceId: serial, disabled, uninstalled, cleared }
}
