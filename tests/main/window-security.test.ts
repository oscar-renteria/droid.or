import { describe, expect, it } from 'vitest'
import { isAppUrl, isPermissionAllowed } from '@main/window-security'

describe('isAppUrl', () => {
  const linuxIndex = '/opt/droid.or/resources/app.asar/out/renderer/index.html'
  const windowsIndex = 'C:\\Program Files\\droid.or\\resources\\app.asar\\out\\renderer\\index.html'

  it('accepts the bundled renderer page, including Windows drive paths and spaces', () => {
    expect(isAppUrl(`file://${linuxIndex}#/install`, linuxIndex, undefined)).toBe(true)
    expect(
      isAppUrl(
        'file:///C:/Program%20Files/droid.or/resources/app.asar/out/renderer/index.html',
        windowsIndex,
        undefined
      )
    ).toBe(true)
  })

  it('rejects other files, remote pages and garbage in production', () => {
    expect(isAppUrl('file:///etc/passwd', linuxIndex, undefined)).toBe(false)
    expect(isAppUrl('https://github.com/', linuxIndex, undefined)).toBe(false)
    expect(isAppUrl('not a url', linuxIndex, undefined)).toBe(false)
  })

  it('accepts only the dev server origin in development', () => {
    const dev = 'http://localhost:5173'
    expect(isAppUrl('http://localhost:5173/#/apps', linuxIndex, dev)).toBe(true)
    expect(isAppUrl('http://localhost:5174/', linuxIndex, dev)).toBe(false)
    expect(isAppUrl(`file://${linuxIndex}`, linuxIndex, dev)).toBe(false)
  })
})

describe('isPermissionAllowed', () => {
  it('allows only the clipboard write used by the copy-link fallback', () => {
    expect(isPermissionAllowed('clipboard-sanitized-write')).toBe(true)
    for (const permission of [
      'media',
      'notifications',
      'geolocation',
      'hid',
      'usb',
      'openExternal'
    ]) {
      expect(isPermissionAllowed(permission)).toBe(false)
    }
  })
})
