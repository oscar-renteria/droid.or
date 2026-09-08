import { z } from 'zod'

export const securityReviewResultSchema = z.object({
  /** Package names currently holding Device Admin — one of the two ways
   *  an app can make itself hard to remove/disable normally. Many
   *  legitimate apps (MDM tools, "hibernate background apps" utilities,
   *  Find My Device) request this for real, advertised reasons. */
  deviceAdminPackages: z.array(z.string()),
  /** Package names currently holding an enabled Accessibility Service —
   *  the other common persistence/abuse mechanism, since it grants an
   *  app the ability to observe and interact with the screen. Screen
   *  readers, launchers, and automation tools legitimately use this
   *  too. */
  accessibilityServicePackages: z.array(z.string())
})
export type SecurityReviewResult = z.infer<typeof securityReviewResultSchema>

export const getSecurityReviewRequestSchema = z.object({
  deviceId: z.string().min(1)
})
