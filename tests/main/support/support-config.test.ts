import { describe, expect, it } from 'vitest'
import { PAYPAL_DONATION_URL } from '@shared/constants/support'
import { DONATION_URLS, validateSafeExternalUrl } from '@main/support/support-config'

describe('support configuration', () => {
  it('configures the approved donation destinations', () => {
    expect(validateSafeExternalUrl(DONATION_URLS['github-sponsors'])).toBe(true)
    expect(DONATION_URLS['github-sponsors']).toBe('https://github.com/sponsors/oscar-renteria')
    expect(validateSafeExternalUrl('https://github.com/other-project')).toBe(true)
    expect(validateSafeExternalUrl('https://ko-fi.com/droid_or')).toBe(false)

    expect(DONATION_URLS.paypal).toBe(PAYPAL_DONATION_URL)
    expect(DONATION_URLS.paypal).toBe('https://paypal.me/ORenteriaQuevedo')
    expect(validateSafeExternalUrl(DONATION_URLS.paypal)).toBe(true)
  })

  it.each([
    'http://github.com/sponsors/oscar-renteria',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://evil-github.com',
    'https://github.com.evil.example',
    'https://evil-paypal.me/ORenteriaQuevedo',
    'https://paypal.me.evil.example/ORenteriaQuevedo',
    'https://www.paypal.me/ORenteriaQuevedo',
    'not a URL'
  ])('rejects unsafe URL %j', (url) => {
    expect(validateSafeExternalUrl(url)).toBe(false)
  })
})
