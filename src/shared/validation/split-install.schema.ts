import { z } from 'zod'
import { installPlanSchema } from './apk-install.schema'

/** How the user pointed the app at a set of split APK files. */
export const splitSourceKindSchema = z.enum(['archive', 'directory', 'files'])
export type SplitSourceKind = z.infer<typeof splitSourceKindSchema>

/** What role a single file plays within a split/bundle install set, inferred
 *  from its file name (see classifySplitFileName) — never from parsing the
 *  binary manifest, which app-info-parser doesn't expose for this. */
export const splitPartRoleSchema = z.enum(['base', 'abi', 'density', 'language', 'unknown'])
export type SplitPartRole = z.infer<typeof splitPartRoleSchema>

export const splitApkPartSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
  role: splitPartRoleSchema,
  /** Set only when role is 'abi', e.g. "arm64-v8a". */
  abi: z.string().nullable(),
  /** Set only when role is 'density', e.g. "xxhdpi". */
  density: z.string().nullable(),
  /** Set only when role is 'language', e.g. "en" or "zh-hans". */
  language: z.string().nullable(),
  /** The manifest's raw `split` attribute, when the file had one — shown
   *  to the user even when role is 'unknown' (e.g. a named dynamic
   *  feature module this app doesn't have a dedicated role for), so
   *  nothing about the classification is hidden. Null on the base APK and
   *  on a file whose manifest couldn't be read at all. */
  rawSplitAttribute: z.string().nullable(),
  packageName: z.string().nullable(),
  versionName: z.string().nullable(),
  versionCode: z.number().int().nullable(),
  minSdkVersion: z.number().int().nullable(),
  targetSdkVersion: z.number().int().nullable(),
  label: z.string().nullable(),
  iconDataUrl: z.string().nullable(),
  /** Whether this specific file can actually be installed on the connected
   *  device. Only ever false for an 'abi' part whose architecture isn't in
   *  the device's supported ABI list — density/language/base/unknown parts
   *  are always compatible (Android simply ignores config resources it has
   *  no matching device configuration for). */
  deviceCompatible: z.boolean()
})
export type SplitApkPart = z.infer<typeof splitApkPartSchema>

export const splitInstallIssueSeveritySchema = z.enum(['error', 'warning', 'info'])
export type SplitInstallIssueSeverity = z.infer<typeof splitInstallIssueSeveritySchema>

export const splitInstallIssueCodeSchema = z.enum([
  'unreadable-part',
  'no-base-apk-detected',
  'multiple-base-apks-detected',
  'package-name-mismatch',
  'version-code-mismatch',
  'min-sdk-too-high',
  'no-compatible-abi-split',
  'signing-consistency-not-verifiable',
  'non-apk-content-present',
  'downgrade-attempt'
])
export type SplitInstallIssueCode = z.infer<typeof splitInstallIssueCodeSchema>

export const splitInstallIssueSchema = z.object({
  code: splitInstallIssueCodeSchema,
  severity: splitInstallIssueSeveritySchema,
  message: z.string()
})
export type SplitInstallIssue = z.infer<typeof splitInstallIssueSchema>

export const splitInstallAnalysisSchema = z.object({
  sourceKind: splitSourceKindSchema,
  sourcePaths: z.array(z.string().min(1)).min(1),
  packageName: z.string().nullable(),
  versionName: z.string().nullable(),
  versionCode: z.number().int().nullable(),
  label: z.string().nullable(),
  iconDataUrl: z.string().nullable(),
  /** The device's most-preferred ABI (the first entry of
   *  `ro.product.cpu.abilist`), used by the renderer to pre-select only
   *  the one matching native-library split by default instead of every
   *  ABI split the device could technically run. Null only when the
   *  device reported no ABI information at all. */
  devicePrimaryAbi: z.string().nullable(),
  /** The device's actual screen-density bucket (see mapDpiToDensityBucket),
   *  used the same way as devicePrimaryAbi to pre-select only the one
   *  matching density split by default. Null when `wm density` couldn't be
   *  read. */
  deviceDensityBucket: z.string().nullable(),
  /** Ordered base → abi → density → language → unknown, the same order
   *  they'd be passed to `adb install-multiple`. */
  parts: z.array(splitApkPartSchema),
  issues: z.array(splitInstallIssueSchema),
  /** false whenever an 'error'-severity issue is present. The UI trusts
   *  this rather than re-deriving it from `issues` itself. */
  canInstall: z.boolean(),
  /** Null only when canInstall is false and no package name could be
   *  resolved at all. */
  plan: installPlanSchema.nullable()
})
export type SplitInstallAnalysis = z.infer<typeof splitInstallAnalysisSchema>

export const analyzeSplitSourceRequestSchema = z.object({
  deviceId: z.string().min(1),
  sourceKind: splitSourceKindSchema,
  sourcePaths: z.array(z.string().min(1)).min(1)
})

export const installSplitApksRequestSchema = z.object({
  deviceId: z.string().min(1),
  sourceKind: splitSourceKindSchema,
  sourcePaths: z.array(z.string().min(1)).min(1),
  /** File names (not paths — an archive source re-extracts to a fresh temp
   *  directory on every call, so paths from a prior analysis wouldn't
   *  resolve) of the parts to actually install, as toggled in the Confirm
   *  step. The base part is always installed regardless of whether it's
   *  listed here. */
  selectedFileNames: z.array(z.string().min(1)).min(1)
})
