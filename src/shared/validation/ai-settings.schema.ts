import { z } from 'zod'

export const aiProviderIdSchema = z.enum(['anthropic', 'openai-compatible'])
export type AiProviderId = z.infer<typeof aiProviderIdSchema>

export const aiSettingsSchema = z.object({
  provider: aiProviderIdSchema.nullable(),
  model: z.string().nullable(),
  /** Only meaningful for the 'openai-compatible' provider. */
  baseUrl: z.string().nullable(),
  /** Whether a key is currently stored — the key itself is never sent to
   *  the renderer. */
  hasApiKey: z.boolean()
})
export type AiSettings = z.infer<typeof aiSettingsSchema>

export const setAiSettingsRequestSchema = z.object({
  provider: aiProviderIdSchema.nullable(),
  model: z.string().nullable(),
  baseUrl: z.string().nullable(),
  /** Omit the field entirely to leave the stored key untouched; pass null
   *  (or an empty string) to clear it; pass a non-empty string to replace
   *  it. */
  apiKey: z.string().nullable().optional()
})

export const analyzePackageWithAiRequestSchema = z.object({
  deviceId: z.string().min(1),
  packageName: z.string().min(1),
  displayName: z.string().nullable(),
  versionName: z.string().nullable(),
  isSystemApp: z.boolean()
})

export const aiAnalysisResultSchema = z.object({
  /** The model's free-text answer — shown as-is, never parsed into a risk
   *  level or otherwise treated as authoritative. */
  text: z.string(),
  model: z.string(),
  provider: aiProviderIdSchema
})
export type AiAnalysisResult = z.infer<typeof aiAnalysisResultSchema>
