import { z } from 'zod'

export const bootloaderStateSchema = z.enum([
  'locked',
  'unlocked',
  'unlocked-custom-key',
  'verification-failed',
  'unknown'
])
export type BootloaderState = z.infer<typeof bootloaderStateSchema>

export const rootHeuristicSchema = z.enum(['likely', 'possible', 'unlikely'])
export type RootHeuristicVerdict = z.infer<typeof rootHeuristicSchema>

const basicInfoSchema = z.object({
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  deviceName: z.string().nullable(),
  androidVersion: z.string().nullable(),
  sdkVersion: z.number().int().positive().nullable(),
  buildNumber: z.string().nullable(),
  securityPatch: z.string().nullable(),
  kernelVersion: z.string().nullable(),
  cpuAbi: z.string().nullable(),
  bootloaderState: bootloaderStateSchema,
  rootHeuristic: rootHeuristicSchema,
  usbDebuggingEnabled: z.boolean().nullable()
})

const hardwareInfoSchema = z.object({
  cpuCoreCount: z.number().int().positive().nullable(),
  ramTotalMb: z.number().nonnegative().nullable(),
  ramAvailableMb: z.number().nonnegative().nullable(),
  storageTotalMb: z.number().nonnegative().nullable(),
  storageAvailableMb: z.number().nonnegative().nullable(),
  batteryPercent: z.number().min(0).max(100).nullable(),
  batteryTemperatureCelsius: z.number().nullable(),
  batteryHealth: z.string().nullable(),
  screenResolution: z.string().nullable(),
  /** Best-effort: see parseActiveRefreshRateHz for why this can be null even
   *  on a device with a perfectly normal display. */
  refreshRateHz: z.number().positive().nullable(),
  displayDensityDpi: z.number().positive().nullable()
})

const systemInfoSchema = z.object({
  uptimeSeconds: z.number().nonnegative().nullable(),
  selinuxStatus: z.string().nullable(),
  encryptionState: z.string().nullable(),
  encryptionType: z.string().nullable(),
  abUpdate: z.boolean().nullable(),
  activeSlot: z.string().nullable()
})

export const deviceDashboardInfoSchema = z.object({
  deviceId: z.string().min(1),
  fetchedAt: z.iso.datetime(),
  basic: basicInfoSchema,
  hardware: hardwareInfoSchema,
  system: systemInfoSchema
})

export type DeviceDashboardInfo = z.infer<typeof deviceDashboardInfoSchema>

export const dashboardInfoRequestSchema = z.object({
  id: z.string().min(1)
})
