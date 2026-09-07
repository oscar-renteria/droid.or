import { describe, expect, it } from 'vitest'
import { fetchDeviceDashboardInfo } from '@main/android/device-dashboard.service'
import { SU_PROBE_SHELL_COMMAND } from '@main/adb/root-heuristic'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'

function setUpRealisticDevice(adb: FakeAdbClient): void {
  adb.deviceProperties.set(
    SERIAL,
    new Map([
      ['ro.product.manufacturer', 'samsung'],
      ['ro.product.model', 'SM-F766B'],
      ['ro.build.version.release', '16'],
      ['ro.build.version.sdk', '36'],
      ['ro.build.display.id', 'BP4A.251205.006.F766BXXSBBZG3'],
      ['ro.build.version.security_patch', '2026-07-05'],
      ['ro.product.cpu.abi', 'arm64-v8a'],
      ['ro.boot.verifiedbootstate', 'green'],
      ['ro.build.tags', 'release-keys'],
      ['ro.debuggable', '0'],
      ['ro.secure', '1'],
      ['ro.crypto.state', 'encrypted'],
      ['ro.crypto.type', 'file'],
      ['ro.build.ab_update', 'true'],
      ['ro.boot.slot_suffix', '_a']
    ])
  )

  adb.shellResponses.set(
    `${SERIAL}\ndumpsys battery`,
    'Current Battery Service state:\n  level: 59\n  scale: 100\n  health: 2\n  temperature: 312\n'
  )
  adb.shellResponses.set(`${SERIAL}\nwm size`, 'Physical size: 1080x2520')
  adb.shellResponses.set(`${SERIAL}\nwm density`, 'Physical density: 480\nOverride density: 420')
  adb.shellResponses.set(
    `${SERIAL}\ndumpsys display`,
    'DisplayDeviceInfo{"Built-in Screen": modeId 5, renderFrameRate 30.0}'
  )
  adb.shellResponses.set(
    `${SERIAL}\ncat /proc/meminfo`,
    'MemTotal:       11481680 kB\nMemAvailable:    4133952 kB'
  )
  adb.shellResponses.set(
    `${SERIAL}\ndf /data`,
    'Filesystem       1K-blocks      Used Available Use% Mounted on\n/dev/block/dm-74 232318976 115395296 116792608  50% /data/user/0'
  )
  adb.shellResponses.set(`${SERIAL}\ncat /proc/uptime`, '1121348.54 4655703.72')
  adb.shellResponses.set(`${SERIAL}\ngetenforce`, 'Enforcing')
  adb.shellResponses.set(`${SERIAL}\nuname -r`, '6.6.102-android15-8-abogkiF766BXXSBBZG3-4k')
  adb.shellResponses.set(`${SERIAL}\nsettings get global device_name`, 'Galaxy Z Flip7')
  adb.shellResponses.set(`${SERIAL}\nsettings get global adb_enabled`, '1')
  adb.shellResponses.set(
    `${SERIAL}\ncat /proc/cpuinfo`,
    Array.from({ length: 10 }, (_, i) => `processor\t: ${i}`).join('\n')
  )
  adb.shellResponses.set(`${SERIAL}\n${SU_PROBE_SHELL_COMMAND}`, '')
}

describe('fetchDeviceDashboardInfo', () => {
  it('assembles the full dashboard from realistic device responses', async () => {
    const adb = new FakeAdbClient()
    setUpRealisticDevice(adb)

    const info = await fetchDeviceDashboardInfo(adb, SERIAL)

    expect(info.deviceId).toBe(SERIAL)
    expect(info.basic).toMatchObject({
      manufacturer: 'samsung',
      model: 'SM-F766B',
      deviceName: 'Galaxy Z Flip7',
      androidVersion: '16',
      sdkVersion: 36,
      buildNumber: 'BP4A.251205.006.F766BXXSBBZG3',
      securityPatch: '2026-07-05',
      kernelVersion: '6.6.102-android15-8-abogkiF766BXXSBBZG3-4k',
      cpuAbi: 'arm64-v8a',
      bootloaderState: 'locked',
      rootHeuristic: 'unlikely',
      usbDebuggingEnabled: true
    })
    expect(info.hardware).toMatchObject({
      cpuCoreCount: 10,
      ramTotalMb: 11213,
      batteryPercent: 59,
      batteryTemperatureCelsius: 31.2,
      batteryHealth: 'Good',
      screenResolution: '1080x2520',
      refreshRateHz: 30,
      displayDensityDpi: 420
    })
    expect(info.system).toMatchObject({
      selinuxStatus: 'Enforcing',
      encryptionState: 'encrypted',
      encryptionType: 'file',
      abUpdate: true,
      activeSlot: '_a'
    })
    expect(info.system.uptimeSeconds).toBeCloseTo(1121348.54)
  })

  it('degrades individual fields to null instead of failing the whole dashboard', async () => {
    const adb = new FakeAdbClient()
    // No properties or shell responses configured at all — every call rejects.
    const info = await fetchDeviceDashboardInfo(adb, 'UNCONFIGURED')

    expect(info.deviceId).toBe('UNCONFIGURED')
    expect(info.basic.manufacturer).toBeNull()
    expect(info.basic.bootloaderState).toBe('unknown')
    expect(info.basic.rootHeuristic).toBe('unlikely')
    expect(info.hardware.batteryPercent).toBeNull()
    expect(info.hardware.cpuCoreCount).toBeNull()
    expect(info.system.uptimeSeconds).toBeNull()
  })
})
