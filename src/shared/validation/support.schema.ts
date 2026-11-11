import { z } from 'zod'

export const donationProviderIdSchema = z.enum(['github-sponsors'])
export type DonationProviderId = z.infer<typeof donationProviderIdSchema>

export const openDonationLinkResultSchema = z.object({
  success: z.boolean(),
  urlOpened: z.string().url().nullable(),
  error: z.string().nullable()
})
export type OpenDonationLinkResult = z.infer<typeof openDonationLinkResultSchema>
