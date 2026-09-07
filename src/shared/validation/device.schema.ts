import { z } from 'zod'

/**
 * States ADB itself reports for a device (plus 'no-permissions', which is
 * Linux-specific: udev denies access before adb can even read the real
 * serial, so adb prints a placeholder like "??????????" instead of a serial).
 * Deliberately excludes bootloader/fastboot mode: a device in that mode
 * speaks the fastboot protocol, not ADB's, and simply does not appear in
 * `adb devices` output at all — detecting it would require a separate
 * fastboot integration, which does not exist yet.
 */
export const deviceConnectionStateSchema = z.enum([
  'device',
  'unauthorized',
  'authorizing',
  'offline',
  'sideload',
  'recovery',
  'no-permissions',
  'disconnected'
])

export type DeviceConnectionState = z.infer<typeof deviceConnectionStateSchema>

export const knownDeviceSchema = z.object({
  /** ADB serial number. Stable for USB-attached devices; not meaningful yet
   *  for a future wireless-ADB device, whose "serial" is an ip:port pair
   *  that changes across reconnects — that case needs its own identity
   *  strategy when wireless ADB is implemented. */
  id: z.string().min(1),
  nickname: z.string().min(1).nullable(),
  manufacturer: z.string().min(1).nullable(),
  model: z.string().min(1).nullable(),
  androidVersion: z.string().min(1).nullable(),
  sdkVersion: z.number().int().positive().nullable(),
  connectionState: deviceConnectionStateSchema,
  firstSeenAt: z.iso.datetime(),
  lastConnectedAt: z.iso.datetime().nullable()
})

export type KnownDevice = z.infer<typeof knownDeviceSchema>

export const deviceListSchema = z.array(knownDeviceSchema)

export const adbAvailabilitySchema = z.discriminatedUnion('available', [
  z.object({ available: z.literal(true), version: z.string() }),
  z.object({ available: z.literal(false), reason: z.string() })
])

export type AdbAvailability = z.infer<typeof adbAvailabilitySchema>

export const renameDeviceRequestSchema = z.object({
  id: z.string().min(1),
  nickname: z.string().trim().min(1).max(64).nullable()
})

export const deviceIdRequestSchema = z.object({
  id: z.string().min(1)
})
