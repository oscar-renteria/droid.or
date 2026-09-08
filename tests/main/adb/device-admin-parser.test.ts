import { describe, expect, it } from 'vitest'
import { parseDeviceAdminPackages } from '@main/adb/parsers/device-admin-parser'

describe('parseDeviceAdminPackages', () => {
  it('extracts package names from the Enabled Device Admins section', () => {
    const output = [
      'Current Device Policy Manager state:',
      '  Enabled Device Admins:',
      '    com.google.android.apps.work.clouddpc/.receivers.CloudDeviceAdminReceiver:',
      '      admin=ComponentInfo{com.google.android.apps.work.clouddpc/.receivers.CloudDeviceAdminReceiver}',
      '      isPasswordSufficient=true',
      '    com.example.finder/.DeviceAdminReceiver:',
      '      admin=ComponentInfo{com.example.finder/.DeviceAdminReceiver}',
      '  Other section:',
      '    com.should.not.match/.Foo:'
    ].join('\n')

    const result = parseDeviceAdminPackages(output)
    expect(result).toEqual(['com.google.android.apps.work.clouddpc', 'com.example.finder'])
  })

  it('returns an empty array when no admins are enabled', () => {
    const output =
      'Current Device Policy Manager state:\n  Enabled Device Admins:\n  Other section:\n'
    expect(parseDeviceAdminPackages(output)).toEqual([])
  })

  it('returns an empty array when the section header is missing entirely', () => {
    expect(
      parseDeviceAdminPackages('Current Device Policy Manager state:\n  Nothing here\n')
    ).toEqual([])
  })

  it('deduplicates a package that appears more than once', () => {
    const output = [
      '  Enabled Device Admins:',
      '    com.example.dup/.AdminOne:',
      '    com.example.dup/.AdminTwo:'
    ].join('\n')
    expect(parseDeviceAdminPackages(output)).toEqual(['com.example.dup'])
  })

  it('does not pick up more deeply indented detail lines as new admins', () => {
    const output = [
      '  Enabled Device Admins:',
      '    com.example.admin/.Receiver:',
      '      policies=[com.other.notadmin/.Fake:]'
    ].join('\n')
    expect(parseDeviceAdminPackages(output)).toEqual(['com.example.admin'])
  })
})
