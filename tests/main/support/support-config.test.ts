import { describe, expect, it } from 'vitest'
import { DONATION_URLS, validateSafeExternalUrl } from '@main/support/support-config'

describe('support configuration', () => {
  it('accepts only the configured HTTPS donation URLs', () => {
    expect(validateSafeExternalUrl(DONATION_URLS['github-sponsors'])).toBe(true)
    expect(validateSafeExternalUrl(DONATION_URLS.kofi)).toBe(true)
    expect(validateSafeExternalUrl('https://github.com/other-project')).toBe(true)
  })

  it.each([
    'http://github.com/sponsors/droid-or',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://evil-github.com',
    'https://github.com.evil.example',
    'not a URL'
  ])('rejects unsafe URL %j', (url) => {
    expect(validateSafeExternalUrl(url)).toBe(false)
  })
})
