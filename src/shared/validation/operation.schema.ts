import { z } from 'zod'

export const operationTypeSchema = z.enum([
  'disable',
  'enable',
  'uninstall-for-user',
  'clear-data',
  // Reverses a prior `uninstall-for-user` on a package the device still
  // knows about (its APK is still on the system partition) — used only by
  // the Device Recovery page, never offered as a first-class action.
  'restore-install'
])
export type OperationType = z.infer<typeof operationTypeSchema>

export const performOperationRequestSchema = z.object({
  deviceId: z.string().min(1),
  packageName: z.string().min(1),
  operation: operationTypeSchema
})

export const operationResultSchema = z.object({
  success: z.boolean(),
  /** Human-readable outcome, e.g. "Disabled successfully" or a specific
   *  failure reason extracted from the device's response. */
  message: z.string(),
  /** Full stdout/stderr from the device, for the "technical details" the
   *  spec asks for — never shown as the primary message. */
  rawOutput: z.string()
})
export type OperationResult = z.infer<typeof operationResultSchema>

export const operationHistoryEntrySchema = z.object({
  id: z.number().int().positive(),
  deviceId: z.string().min(1),
  packageName: z.string().min(1),
  operation: operationTypeSchema,
  previousState: z.string().nullable(),
  newState: z.string().nullable(),
  success: z.boolean(),
  rawOutput: z.string(),
  performedAt: z.iso.datetime()
})
export type OperationHistoryEntry = z.infer<typeof operationHistoryEntrySchema>

export const operationHistoryListSchema = z.array(operationHistoryEntrySchema)

export const getHistoryRequestSchema = z.object({
  deviceId: z.string().min(1)
})
