/**
 * Everything a package-analysis prompt needs to say something useful.
 * Deliberately narrow — no device serial, no user data, nothing beyond
 * what the spec explicitly names as reasonable to send for this purpose
 * (manufacturer, model, Android version, package name, app label,
 * version, permissions, system/user classification).
 */
export interface PackageAiAnalysisInput {
  manufacturer: string | null
  model: string | null
  androidVersion: string | null
  packageName: string
  appLabel: string | null
  versionName: string | null
  isSystemApp: boolean
  permissions: string[]
}

export interface AiProviderConfig {
  apiKey: string
  model: string
  /** Only meaningful for the OpenAI-compatible provider — ignored by the
   *  Anthropic provider, which always targets Anthropic's own API. */
  baseUrl: string | null
}

export interface AiAnalysisResult {
  /** The model's free-text answer, shown to the user as-is — never parsed
   *  into a risk level or otherwise treated as authoritative. Per the
   *  spec: AI output is advisory information, not ground truth. */
  text: string
  model: string
}

export interface AiProvider {
  analyzePackage(input: PackageAiAnalysisInput, config: AiProviderConfig): Promise<AiAnalysisResult>
}
