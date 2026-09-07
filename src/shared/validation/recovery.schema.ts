import { z } from 'zod'

export const getDeviceChangesRequestSchema = z.object({
  deviceId: z.string().min(1)
})

/** A package currently left in a modified (disable/uninstall) state by this
 *  app, still verified against the device's live, present-tense state —
 *  not just what history recorded — so a change reverted outside this app
 *  (e.g. re-enabled from Settings) never shows up here as needing restore. */
export const restorablePackageChangeSchema = z.object({
  packageName: z.string().min(1),
  operation: z.enum(['disable', 'uninstall-for-user']),
  performedAt: z.iso.datetime(),
  restorable: z.boolean(),
  /** Set only when restorable is false — why this specific package can't
   *  be put back, e.g. its APK is no longer on the device at all. */
  blockedReason: z.string().nullable()
})
export type RestorablePackageChange = z.infer<typeof restorablePackageChangeSchema>

/** Data cleared by this app has no undo and no persistent "is it still
 *  cleared" state to re-check — this is purely a historical record. */
export const clearedPackageChangeSchema = z.object({
  packageName: z.string().min(1),
  performedAt: z.iso.datetime()
})
export type ClearedPackageChange = z.infer<typeof clearedPackageChangeSchema>

export const deviceChangesSchema = z.object({
  deviceId: z.string().min(1),
  disabled: z.array(restorablePackageChangeSchema),
  uninstalled: z.array(restorablePackageChangeSchema),
  cleared: z.array(clearedPackageChangeSchema)
})
export type DeviceChanges = z.infer<typeof deviceChangesSchema>
