import { z } from 'zod'

export const riskLevelSchema = z.enum(['safe', 'caution', 'advanced', 'critical'])
export type RiskLevel = z.infer<typeof riskLevelSchema>

export const packageRecommendationSchema = z.object({
  packageName: z.string().min(1),
  displayName: z.string().nullable(),
  isSystemApp: z.boolean(),
  isDisabled: z.boolean(),
  isRunning: z.boolean(),
  risk: riskLevelSchema,
  /** Why this package received this classification. */
  reason: z.string(),
  /** What functionality is lost if the package is removed/disabled. */
  potentialImpact: z.string(),
  /** True when the classification came from the curated database rather
   *  than the conservative unknown-package fallback — shown in the UI so
   *  the user can tell a specific, reasoned recommendation apart from a
   *  generic "we don't actually know" default. */
  isKnownPackage: z.boolean(),
  isIgnored: z.boolean(),
  isFavorite: z.boolean()
})

export type PackageRecommendation = z.infer<typeof packageRecommendationSchema>

export const analyzeDeviceResultSchema = z.object({
  deviceId: z.string().min(1),
  analyzedAt: z.iso.datetime(),
  /** Counts across every system package considered, including ones not
   *  shown in `recommendations` (critical, ignored, or already reviewed). */
  summary: z.object({
    safe: z.number().int().nonnegative(),
    caution: z.number().int().nonnegative(),
    advanced: z.number().int().nonnegative(),
    critical: z.number().int().nonnegative(),
    ignored: z.number().int().nonnegative()
  }),
  /** System packages only, excluding critical ones — user-installed apps
   *  are deliberately not analyzed here: the user already chose to install
   *  them, so there is nothing to "recommend" about them the way there is
   *  for preinstalled OEM/carrier bloat. */
  recommendations: z.array(packageRecommendationSchema)
})

export type AnalyzeDeviceResult = z.infer<typeof analyzeDeviceResultSchema>

export const analyzeDeviceRequestSchema = z.object({
  deviceId: z.string().min(1)
})

export const setPackageIgnoredRequestSchema = z.object({
  packageName: z.string().min(1),
  ignored: z.boolean()
})
