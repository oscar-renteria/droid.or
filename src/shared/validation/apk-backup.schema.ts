import { z } from 'zod'

export const backupFileResultSchema = z.object({
  remotePath: z.string(),
  fileName: z.string(),
  success: z.boolean(),
  errorMessage: z.string().nullable()
})
export type BackupFileResult = z.infer<typeof backupFileResultSchema>

export const packageBackupResultSchema = z.object({
  packageName: z.string(),
  success: z.boolean(),
  /** One entry per APK file the package has on the device — more than one
   *  for an app installed as a split/bundle. */
  files: z.array(backupFileResultSchema),
  errorMessage: z.string().nullable()
})
export type PackageBackupResult = z.infer<typeof packageBackupResultSchema>

export const backupPackagesRequestSchema = z.object({
  deviceId: z.string().min(1),
  packageNames: z.array(z.string().min(1)).min(1),
  destDir: z.string().min(1)
})
