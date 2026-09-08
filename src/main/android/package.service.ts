import type { AppPackageInfo } from '@shared/validation/package.schema'
import type { AdbClient } from '../adb/adb-client'
import { parsePackageDump } from '../adb/parsers/package-dump-parser'
import {
  parsePackageListWithPathAndInstaller,
  parsePackageNameList
} from '../adb/parsers/package-list-parser'
import { KNOWN_PACKAGE_NAMES } from './known-package-names'

/**
 * Fetches the full installed-package list in a fixed number of calls
 * regardless of how many packages the device has (verified against a real
 * 595-package device) rather than one dumpsys call per package, which would
 * take unacceptably long on a heavily bloated phone.
 */
export async function fetchInstalledPackages(
  adbClient: AdbClient,
  serial: string
): Promise<AppPackageInfo[]> {
  const [listOutput, disabledOutput, thirdPartyOutput, dumpOutput] = await Promise.all([
    adbClient.shellCommand(serial, ['pm', 'list', 'packages', '-f', '-i', '-u']),
    // -u ("also include uninstalled packages") is required here, not just
    // decorative — verified against a real Android 10 tablet where a
    // disabled package (a real, currently-disabled Gmail) was completely
    // absent from `pm list packages -d` without it, silently misreporting
    // it as enabled. The same real device confirmed the identical gap for
    // `-3` two lines below (a disabled third-party app vanished from it
    // too, which would have misclassified it as a system app). The
    // original Samsung/Android 16 device this was first built against
    // happened to list disabled packages via `-d` alone, which is why
    // this went unnoticed until a second, older device was tested.
    adbClient.shellCommand(serial, ['pm', 'list', 'packages', '-d', '-u']),
    adbClient.shellCommand(serial, ['pm', 'list', 'packages', '-3', '-u']),
    adbClient.shellCommand(serial, ['dumpsys', 'package', 'packages'])
  ])

  const entries = parsePackageListWithPathAndInstaller(listOutput)
  const disabledNames = new Set(parsePackageNameList(disabledOutput))
  const thirdPartyNames = new Set(parsePackageNameList(thirdPartyOutput))
  const dumpByPackage = parsePackageDump(dumpOutput)

  return entries.map((entry): AppPackageInfo => {
    const dump = dumpByPackage.get(entry.packageName)
    return {
      packageName: entry.packageName,
      displayName: KNOWN_PACKAGE_NAMES.get(entry.packageName) ?? null,
      apkPath: entry.apkPath,
      installerPackage: entry.installerPackage,
      isSystemApp: !thirdPartyNames.has(entry.packageName),
      isDisabled: disabledNames.has(entry.packageName),
      versionName: dump?.versionName ?? null,
      versionCode: dump?.versionCode ?? null,
      firstInstallTimeMs: dump?.firstInstallTimeMs ?? null,
      lastUpdateTimeMs: dump?.lastUpdateTimeMs ?? null
    }
  })
}
