import { z } from 'zod'

const deviceTransferTargetSchema = z.object({
  sourceDeviceId: z.string().min(1),
  targetDeviceId: z.string().min(1),
  packageName: z.string().min(1)
})

const distinctDevices = {
  check: (request: { sourceDeviceId: string; targetDeviceId: string }) =>
    request.sourceDeviceId !== request.targetDeviceId,
  message: 'The source and target device must be different.'
}

export const analyzeDeviceTransferRequestSchema = deviceTransferTargetSchema.refine(
  distinctDevices.check,
  distinctDevices.message
)

export const performDeviceTransferRequestSchema = deviceTransferTargetSchema
  .extend({
    /** The version code the user reviewed in the analysis — the install is
     *  refused if a fresh pull from the source no longer matches it. */
    expectedVersionCode: z.number().int().nullable()
  })
  .refine(distinctDevices.check, distinctDevices.message)
