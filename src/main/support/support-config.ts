import type { DonationProviderId } from '@shared/validation/support.schema'

export const DONATION_URLS: Record<DonationProviderId, string> = {
  'github-sponsors': 'https://github.com/sponsors/droid-or',
  kofi: 'https://ko-fi.com/droid_or'
}

const ALLOWED_DOMAINS = new Set(['github.com', 'ko-fi.com'])

export function validateSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    return parsed.protocol === 'https:' && ALLOWED_DOMAINS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
