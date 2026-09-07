import { z } from 'zod'
import { adbAvailabilitySchema } from './device.schema'

/** Where the currently-effective adb command came from, in priority order:
 *  an explicit user override, a managed download this app installed
 *  itself, or whatever "adb" resolves to on the system PATH. */
export const adbSourceSchema = z.enum(['custom', 'managed', 'system'])
export type AdbSource = z.infer<typeof adbSourceSchema>

export const adbStatusSchema = z.object({
  availability: adbAvailabilitySchema,
  source: adbSourceSchema,
  resolvedPath: z.string(),
  customPath: z.string().nullable(),
  managedInstalled: z.boolean(),
  /** False when Google doesn't publish a platform-tools build for this
   *  OS/architecture at all (e.g. Linux on non-x64) — the UI hides the
   *  download action entirely rather than offering something that will
   *  always fail. */
  managedSupported: z.boolean()
})
export type AdbStatus = z.infer<typeof adbStatusSchema>

export const setCustomAdbPathRequestSchema = z.object({
  path: z.string().min(1).nullable()
})
