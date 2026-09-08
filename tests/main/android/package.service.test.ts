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
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u`, 'package:com.disabled.thing')
    adb.shellResponses.set(`${SERIAL}\npm list packages -3 -u`, 'package:com.example.app')
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

    const result = await fetchInstalledPackages(adb, SERIAL, new Set(['com.example.app']))

    expect(result).toHaveLength(3)

    const gmail = result.find((p) => p.packageName === 'com.google.android.gm')
    expect(gmail).toMatchObject({
      displayName: 'Gmail',
      isSystemApp: true,
      isDisabled: false,
      isFavorite: false,
      versionName: '1.0',
      versionCode: 100,
      installerPackage: null
    })

    const thirdParty = result.find((p) => p.packageName === 'com.example.app')
    expect(thirdParty).toMatchObject({
      // Not in the curated known-package table, so the app must fall back
      // to the raw package name rather than inventing one.
      displayName: null,
      isSystemApp: false,
      isDisabled: false,
      // In the favoritePackages set passed in above.
      isFavorite: true,
      versionName: '0.5',
      versionCode: 5,
      installerPackage: 'com.android.vending'
    })

    const disabled = result.find((p) => p.packageName === 'com.disabled.thing')
    expect(disabled).toMatchObject({
      isSystemApp: true,
      isDisabled: true,
      isFavorite: false,
      // Not present in the dumpsys capture, so version info degrades to null
      // rather than failing the whole package.
      versionName: null,
      versionCode: null
    })
  })

  it('passes -u alongside -d and -3, not just -f -i -u — a disabled third-party app was found completely absent from both without it on a real Android 10 device', async () => {
    const adb = new FakeAdbClient()

    adb.shellResponses.set(
      `${SERIAL}\npm list packages -f -i -u`,
      'package:/data/app/com.example.disabled3p/base.apk=com.example.disabled3p  installer=com.android.vending'
    )
    // Both queries include -u this time — reproduces the real device
    // finding that a disabled package is invisible to `-d`/`-3` without
    // it, by asserting the code actually sends -u, not by testing a
    // fallback.
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u`, 'package:com.example.disabled3p')
    adb.shellResponses.set(`${SERIAL}\npm list packages -3 -u`, 'package:com.example.disabled3p')
    adb.shellResponses.set(`${SERIAL}\ndumpsys package packages`, '')

    const result = await fetchInstalledPackages(adb, SERIAL, new Set())

    expect(result).toEqual([
      expect.objectContaining({
        packageName: 'com.example.disabled3p',
        isSystemApp: false,
        isDisabled: true
      })
    ])
  })
})
