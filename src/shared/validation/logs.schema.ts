import { z } from 'zod'

export const adbCommandLogCategorySchema = z.enum([
  'list-devices',
  'get-properties',
  'shell',
  'mutation',
  'pull-file',
  'install-apk'
])
export type AdbCommandLogCategory = z.infer<typeof adbCommandLogCategorySchema>

export const adbCommandLogEntrySchema = z.object({
  id: z.number().int().positive(),
  timestamp: z.iso.datetime(),
  deviceId: z.string().nullable(),
  category: adbCommandLogCategorySchema,
  command: z.string(),
  durationMs: z.number().int().nonnegative(),
  success: z.boolean(),
  errorMessage: z.string().nullable()
})
export type AdbCommandLogEntry = z.infer<typeof adbCommandLogEntrySchema>

export const adbCommandLogListSchema = z.array(adbCommandLogEntrySchema)
