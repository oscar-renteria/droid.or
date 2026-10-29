import { describe, expect, it } from 'vitest'
import {
  donationProviderIdSchema,
  openDonationLinkResultSchema
} from '@shared/validation/support.schema'

describe('support schemas', () => {
  it('accepts the approved donation providers', () => {
    expect(donationProviderIdSchema.safeParse('github-sponsors').success).toBe(true)
    expect(donationProviderIdSchema.safeParse('kofi').success).toBe(true)
  })

  it.each(['paypal', 'unknown', ''])('rejects %j as a donation provider', (provider) => {
    expect(donationProviderIdSchema.safeParse(provider).success).toBe(false)
  })

  it('accepts an open-donation-link result', () => {
    expect(
      openDonationLinkResultSchema.safeParse({
        success: true,
        urlOpened: 'https://github.com/sponsors/droid-or',
        error: null
      }).success
    ).toBe(true)
  })
})
