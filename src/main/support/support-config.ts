import type { DonationProviderId } from '@shared/validation/support.schema'
import { GITHUB_SPONSORS_URL } from '@shared/constants/support'

export const DONATION_URLS: Record<DonationProviderId, string> = {
  'github-sponsors': GITHUB_SPONSORS_URL
}

const ALLOWED_DOMAINS = new Set(['github.com'])

export function validateSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    return parsed.protocol === 'https:' && ALLOWED_DOMAINS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
