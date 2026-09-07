import { z } from 'zod'

export const localApkInfoSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
  packageName: z.string().min(1),
  versionName: z.string().nullable(),
  versionCode: z.number().int().nullable(),
  minSdkVersion: z.number().int().nullable(),
  targetSdkVersion: z.number().int().nullable(),
  label: z.string().nullable(),
  iconDataUrl: z.string().nullable()
})
export type LocalApkInfo = z.infer<typeof localApkInfoSchema>

/** What installing this specific file would do, given what's (or isn't)
 *  already on the device — shown to the user before they confirm. */
export const installPlanOperationSchema = z.enum([
  'fresh-install',
  'update',
  'reinstall-same-version',
  'downgrade-attempt'
])
export type InstallPlanOperation = z.infer<typeof installPlanOperationSchema>

export const installPlanSchema = z.object({
  operation: installPlanOperationSchema,
  currentVersionCode: z.number().int().nullable()
})
export type InstallPlan = z.infer<typeof installPlanSchema>

export const inspectApkRequestSchema = z.object({
  deviceId: z.string().min(1),
  filePath: z.string().min(1)
})

export const apkInspectionResultSchema = z.object({
  info: localApkInfoSchema,
  plan: installPlanSchema
})
export type ApkInspectionResult = z.infer<typeof apkInspectionResultSchema>

export const installApkRequestSchema = z.object({
  deviceId: z.string().min(1),
  filePath: z.string().min(1)
})
