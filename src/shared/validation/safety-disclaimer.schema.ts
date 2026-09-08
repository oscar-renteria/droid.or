import { z } from 'zod'

export const safetyDisclaimerStatusSchema = z.object({
  /** Null until the user has clicked through the first-launch disclaimer;
   *  an ISO timestamp of when they did, once they have. */
  acknowledgedAt: z.iso.datetime().nullable()
})
export type SafetyDisclaimerStatus = z.infer<typeof safetyDisclaimerStatusSchema>
