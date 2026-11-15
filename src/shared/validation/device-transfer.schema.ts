import { z } from 'zod'

const deviceSerialSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((serial) => !/\s/.test(serial), 'Device serial must not contain whitespace.')

export const getDeviceTransferPackagesRequestSchema = z.object({
  sourceDeviceId: deviceSerialSchema
})

export const deviceTransferPackageSchema = z.object({
  packageName: z.string().min(1),
  /** From the curated known-package names table; null falls back to the package name. */
  displayName: z.string().nullable(),
  versionName: z.string().nullable(),
  versionCode: z.number().int().nullable()
})

export const deviceTransferPackageListSchema = z.array(deviceTransferPackageSchema)

export type DeviceTransferPackage = z.infer<typeof deviceTransferPackageSchema>

const deviceTransferTargetSchema = z.object({
  sourceDeviceId: z.string().min(1),
  targetDeviceId: z.string().min(1),
  packageName: z.string().min(1)
})

export type DeviceTransferProgressUpdate =
  | {
      phase: 'pulling'
      fileName: string
      fileNumber: number
      totalFiles: number
    }
  | { phase: 'checking' }
  | { phase: 'installing'; fileCount: number }

const transferIdSchema = z.string().uuid()

export const deviceTransferProgressEventSchema = z.discriminatedUnion('phase', [
  z.object({
    transferId: transferIdSchema,
    phase: z.literal('pulling'),
    fileName: z.string().min(1),
    fileNumber: z.number().int().positive(),
    totalFiles: z.number().int().positive()
  }),
  z.object({
    transferId: transferIdSchema,
    phase: z.literal('checking')
  }),
  z.object({
    transferId: transferIdSchema,
    phase: z.literal('installing'),
    fileCount: z.number().int().positive()
  })
])

export type DeviceTransferProgressEvent = z.infer<typeof deviceTransferProgressEventSchema>

const distinctDevices = {
  check: (request: { sourceDeviceId: string; targetDeviceId: string }) =>
    request.sourceDeviceId !== request.targetDeviceId,
  message: 'The source and target device must be different.'
}

export const analyzeDeviceTransferRequestSchema = deviceTransferTargetSchema
  .extend({ transferId: transferIdSchema })
  .refine(distinctDevices.check, distinctDevices.message)

export const performDeviceTransferRequestSchema = deviceTransferTargetSchema
  .extend({
    transferId: transferIdSchema,
    /** The version code the user reviewed in the analysis — the install is
     *  refused if a fresh pull from the source no longer matches it. */
    expectedVersionCode: z.number().int().nullable()
  })
  .refine(distinctDevices.check, distinctDevices.message)
