import { describe, expect, it } from 'vitest'
import { DONATION_URLS, validateSafeExternalUrl } from '@main/support/support-config'

describe('support configuration', () => {
  it('configures GitHub Sponsors as the only approved donation destination', () => {
    expect(validateSafeExternalUrl(DONATION_URLS['github-sponsors'])).toBe(true)
    expect(DONATION_URLS['github-sponsors']).toBe('https://github.com/sponsors/oscar-renteria')
    expect(validateSafeExternalUrl('https://github.com/other-project')).toBe(true)
    expect(validateSafeExternalUrl('https://ko-fi.com/droid_or')).toBe(false)
  })

  it.each([
    'http://github.com/sponsors/oscar-renteria',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'https://evil-github.com',
    'https://github.com.evil.example',
    'not a URL'
  ])('rejects unsafe URL %j', (url) => {
    expect(validateSafeExternalUrl(url)).toBe(false)
  })
})
