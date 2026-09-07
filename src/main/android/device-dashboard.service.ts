import type { DeviceDashboardInfo } from '@shared/validation/device-dashboard.schema'
import type { AdbClient } from '../adb/adb-client'
import { getBootloaderState } from '../adb/bootloader-state'
import { parseBatteryInfo } from '../adb/parsers/battery-info-parser'
import { parseCpuCoreCount } from '../adb/parsers/cpuinfo-parser'
import {
  parseActiveRefreshRateHz,
  parseWmDensity,
  parseWmSize
} from '../adb/parsers/display-info-parser'
import { parseMeminfo } from '../adb/parsers/meminfo-parser'
import { parseStorageInfo } from '../adb/parsers/storage-info-parser'
import { parseUptimeSeconds } from '../adb/parsers/uptime-parser'
import { evaluateRootHeuristic, SU_PROBE_SHELL_COMMAND } from '../adb/root-heuristic'

async function safeShell(
  adbClient: AdbClient,
  serial: string,
  args: string[]
): Promise<string | null> {
  try {
    return await adbClient.shellCommand(serial, args)
  } catch {
    return null
  }
}

function kbToMb(kb: number | null): number | null {
  return kb !== null ? Math.round(kb / 1024) : null
}

function parseSettingValue(output: string | null): string | null {
  // `settings get` prints the literal text "null" for an unset setting,
  // not an empty string.
  const trimmed = output?.trim() ?? ''
  return trimmed.length > 0 && trimmed !== 'null' ? trimmed : null
}

/**
 * Fetches the full device-dashboard field set for one already-authorized
 * device. Every command is predefined here in source — none are ever built
 * from renderer input — and every field degrades to null independently on
 * failure, matching the app-wide "Not available" rule rather than failing
 * the whole dashboard because one field's command didn't work on this OEM.
 */
export async function fetchDeviceDashboardInfo(
  adbClient: AdbClient,
  serial: string
): Promise<DeviceDashboardInfo> {
  const [
    properties,
    batteryOutput,
    wmSizeOutput,
    wmDensityOutput,
    displayOutput,
    meminfoOutput,
    storageOutput,
    uptimeOutput,
    selinuxOutput,
    kernelOutput,
    deviceNameOutput,
    adbEnabledOutput,
    cpuinfoOutput,
    suProbeOutput
  ] = await Promise.all([
    adbClient.getDeviceProperties(serial).catch(() => new Map<string, string>()),
    safeShell(adbClient, serial, ['dumpsys', 'battery']),
    safeShell(adbClient, serial, ['wm', 'size']),
    safeShell(adbClient, serial, ['wm', 'density']),
    safeShell(adbClient, serial, ['dumpsys', 'display']),
    safeShell(adbClient, serial, ['cat', '/proc/meminfo']),
    safeShell(adbClient, serial, ['df', '/data']),
    safeShell(adbClient, serial, ['cat', '/proc/uptime']),
    safeShell(adbClient, serial, ['getenforce']),
    safeShell(adbClient, serial, ['uname', '-r']),
    safeShell(adbClient, serial, ['settings', 'get', 'global', 'device_name']),
    safeShell(adbClient, serial, ['settings', 'get', 'global', 'adb_enabled']),
    safeShell(adbClient, serial, ['cat', '/proc/cpuinfo']),
    safeShell(adbClient, serial, [SU_PROBE_SHELL_COMMAND])
  ])

  const battery = batteryOutput ? parseBatteryInfo(batteryOutput) : null
  const memory = meminfoOutput ? parseMeminfo(meminfoOutput) : null
  const storage = storageOutput ? parseStorageInfo(storageOutput) : null
  const adbEnabledRaw = adbEnabledOutput?.trim()

  const sdkVersionRaw = properties.get('ro.build.version.sdk')
  const sdkVersion = sdkVersionRaw ? Number.parseInt(sdkVersionRaw, 10) : null

  return {
    deviceId: serial,
    fetchedAt: new Date().toISOString(),
    basic: {
      manufacturer: properties.get('ro.product.manufacturer') ?? null,
      model: properties.get('ro.product.model') ?? null,
      deviceName: parseSettingValue(deviceNameOutput),
      androidVersion: properties.get('ro.build.version.release') ?? null,
      sdkVersion: sdkVersion !== null && Number.isFinite(sdkVersion) ? sdkVersion : null,
      buildNumber: properties.get('ro.build.display.id') ?? null,
      securityPatch: properties.get('ro.build.version.security_patch') ?? null,
      kernelVersion: kernelOutput?.trim() || null,
      cpuAbi: properties.get('ro.product.cpu.abi') ?? null,
      bootloaderState: getBootloaderState(properties.get('ro.boot.verifiedbootstate')),
      rootHeuristic: evaluateRootHeuristic({
        buildTags: properties.get('ro.build.tags') ?? null,
        debuggable: properties.get('ro.debuggable') ?? null,
        secure: properties.get('ro.secure') ?? null,
        suProbeOutput
      }),
      usbDebuggingEnabled: adbEnabledRaw === '1' ? true : adbEnabledRaw === '0' ? false : null
    },
    hardware: {
      cpuCoreCount: cpuinfoOutput ? parseCpuCoreCount(cpuinfoOutput) : null,
      ramTotalMb: memory ? kbToMb(memory.totalKb) : null,
      ramAvailableMb: memory ? kbToMb(memory.availableKb) : null,
      storageTotalMb: storage ? kbToMb(storage.totalKb) : null,
      storageAvailableMb: storage ? kbToMb(storage.availableKb) : null,
      batteryPercent: battery?.percent ?? null,
      batteryTemperatureCelsius: battery?.temperatureCelsius ?? null,
      batteryHealth: battery?.health ?? null,
      screenResolution: wmSizeOutput ? parseWmSize(wmSizeOutput) : null,
      refreshRateHz: displayOutput ? parseActiveRefreshRateHz(displayOutput) : null,
      displayDensityDpi: wmDensityOutput ? parseWmDensity(wmDensityOutput) : null
    },
    system: {
      uptimeSeconds: uptimeOutput ? parseUptimeSeconds(uptimeOutput) : null,
      selinuxStatus: selinuxOutput?.trim() || null,
      encryptionState: properties.get('ro.crypto.state') ?? null,
      encryptionType: properties.get('ro.crypto.type') ?? null,
      abUpdate:
        properties.get('ro.build.ab_update') === 'true'
          ? true
          : properties.get('ro.build.ab_update') === 'false'
            ? false
            : null,
      activeSlot: properties.get('ro.boot.slot_suffix') ?? null
    }
  }
}
