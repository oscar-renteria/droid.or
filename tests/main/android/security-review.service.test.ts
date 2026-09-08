import { describe, expect, it } from 'vitest'
import { getSecurityReview } from '@main/android/security-review.service'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'HA1HHCD3'

describe('getSecurityReview', () => {
  it('combines device admin and accessibility service signals from real device output', async () => {
    const adb = new FakeAdbClient()
    adb.shellResponses.set(
      `${SERIAL}\ndumpsys device_policy`,
      [
        'Current Device Policy Manager state:',
        '  Enabled Device Admins:',
        '    com.example.finder/.DeviceAdminReceiver:',
        '      admin=ComponentInfo{com.example.finder/.DeviceAdminReceiver}'
      ].join('\n')
    )
    adb.shellResponses.set(
      `${SERIAL}\nsettings get secure enabled_accessibility_services`,
      'com.example.reader/.ReaderService'
    )

    const result = await getSecurityReview(adb, SERIAL)

    expect(result).toEqual({
      deviceAdminPackages: ['com.example.finder'],
      accessibilityServicePackages: ['com.example.reader']
    })
  })

  it('returns empty arrays when neither signal is present', async () => {
    const adb = new FakeAdbClient()
    adb.shellResponses.set(
      `${SERIAL}\ndumpsys device_policy`,
      'Current Device Policy Manager state:\n  Enabled Device Admins:\n'
    )
    adb.shellResponses.set(`${SERIAL}\nsettings get secure enabled_accessibility_services`, 'null')

    const result = await getSecurityReview(adb, SERIAL)

    expect(result).toEqual({
      deviceAdminPackages: [],
      accessibilityServicePackages: []
    })
  })
})
