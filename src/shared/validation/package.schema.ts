import { z } from 'zod'

export const appPackageInfoSchema = z.object({
  packageName: z.string().min(1),
  apkPath: z.string().nullable(),
  /** Raw installer package name (e.g. "com.android.vending"), or null when
   *  adb reports none (sideloaded, or a preinstalled system app). */
  installerPackage: z.string().nullable(),
  isSystemApp: z.boolean(),
  isDisabled: z.boolean(),
  versionName: z.string().nullable(),
  versionCode: z.number().nullable(),
  /** Parsed in the host's local timezone since dumpsys's raw string carries
   *  no timezone of its own — this can be off by a few hours from the
   *  device's actual timezone. Fine for relative "recently installed"
   *  filtering, not meant for exact-time display. */
  firstInstallTimeMs: z.number().nullable(),
  lastUpdateTimeMs: z.number().nullable()
})

export type AppPackageInfo = z.infer<typeof appPackageInfoSchema>

export const packageListSchema = z.array(appPackageInfoSchema)

export const packageListRequestSchema = z.object({
  deviceId: z.string().min(1)
})
