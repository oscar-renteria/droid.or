import { describe, expect, it } from 'vitest'
import { fetchInstalledPackages } from '@main/android/package.service'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'

describe('fetchInstalledPackages', () => {
  it('merges the four list/dump calls into one package-info array', async () => {
    const adb = new FakeAdbClient()

    adb.shellResponses.set(
      `${SERIAL}\npm list packages -f -i -u`,
      [
        'package:/product/app/Gmail2/Gmail2.apk=com.google.android.gm  installer=null',
        'package:/data/app/~~abc==/com.example.app-def==/base.apk=com.example.app  installer=com.android.vending',
        'package:/system/app/Disabled/d.apk=com.disabled.thing  installer=null'
      ].join('\n')
    )
    adb.shellResponses.set(`${SERIAL}\npm list packages -d`, 'package:com.disabled.thing')
    adb.shellResponses.set(`${SERIAL}\npm list packages -3`, 'package:com.example.app')
    adb.shellResponses.set(
      `${SERIAL}\ndumpsys package packages`,
      [
        '  Package [com.google.android.gm] (aaa):',
        '    versionCode=100 minSdk=1 targetSdk=1',
        '    versionName=1.0',
        '    firstInstallTime=2024-01-01 00:00:00',
        '  Package [com.example.app] (bbb):',
        '    versionCode=5 minSdk=1 targetSdk=1',
        '    versionName=0.5',
        '    firstInstallTime=2025-01-01 00:00:00'
      ].join('\n')
    )

    const result = await fetchInstalledPackages(adb, SERIAL)

    expect(result).toHaveLength(3)

    const gmail = result.find((p) => p.packageName === 'com.google.android.gm')
    expect(gmail).toMatchObject({
      isSystemApp: true,
      isDisabled: false,
      versionName: '1.0',
      versionCode: 100,
      installerPackage: null
    })

    const thirdParty = result.find((p) => p.packageName === 'com.example.app')
    expect(thirdParty).toMatchObject({
      isSystemApp: false,
      isDisabled: false,
      versionName: '0.5',
      versionCode: 5,
      installerPackage: 'com.android.vending'
    })

    const disabled = result.find((p) => p.packageName === 'com.disabled.thing')
    expect(disabled).toMatchObject({
      isSystemApp: true,
      isDisabled: true,
      // Not present in the dumpsys capture, so version info degrades to null
      // rather than failing the whole package.
      versionName: null,
      versionCode: null
    })
  })
})
