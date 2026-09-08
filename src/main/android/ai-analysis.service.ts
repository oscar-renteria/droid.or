import type Database from 'better-sqlite3'
import type { KnownDevice } from '@shared/validation/device.schema'
import type { AiAnalysisResult } from '@shared/validation/ai-settings.schema'
import type { AdbClient } from '../adb/adb-client'
import { parsePackageRequestedPermissions } from '../adb/parsers/package-permissions-parser'
import { AnthropicProvider } from '../ai/anthropic-provider'
import type { AiProvider } from '../ai/ai-provider'
import { OpenAiCompatibleProvider } from '../ai/openai-provider'
import {
  type AiProviderId,
  getAiSettings,
  getDecryptedApiKey,
  type SecretStorage
} from '../persistence/ai-settings.repository'

export interface AnalyzePackageRequest {
  deviceId: string
  packageName: string
  displayName: string | null
  versionName: string | null
  isSystemApp: boolean
}

const REAL_PROVIDERS: Record<AiProviderId, () => AiProvider> = {
  anthropic: () => new AnthropicProvider(),
  'openai-compatible': () => new OpenAiCompatibleProvider()
}

/**
 * On-demand, single-package AI analysis — never run automatically or in
 * bulk across a whole device (that would mean one paid API call per
 * uncertain package with no user confirmation per call, which the spec's
 * "explicit and configurable" network-usage principle argues against).
 * Purely additive to the local, offline analyzer: this never feeds back
 * into risk-classifier.ts or the app's own recommendations, and the
 * result is always presented as advisory, not authoritative.
 *
 * `providers` is injectable (defaulting to the real ones) so tests can
 * exercise the full flow — including what gets built into the prompt
 * input — without a real network call. `secretStorage` is forwarded to
 * `getDecryptedApiKey` the same way, for the same reason (`safeStorage`
 * only exists inside a real Electron process).
 */
export async function analyzePackageWithAi(
  db: Database.Database,
  adbClient: AdbClient,
  device: KnownDevice,
  request: AnalyzePackageRequest,
  providers: Record<AiProviderId, () => AiProvider> = REAL_PROVIDERS,
  secretStorage?: SecretStorage
): Promise<AiAnalysisResult> {
  const settings = getAiSettings(db)
  if (!settings.provider) {
    throw new Error('No AI provider is configured yet. Set one up on the Settings page first.')
  }
  if (!settings.model) {
    throw new Error('No model is configured for AI analysis. Set one on the Settings page.')
  }
  const apiKey = getDecryptedApiKey(db, secretStorage)
  if (!apiKey) {
    throw new Error('No API key is configured for AI analysis. Add one on the Settings page.')
  }

  const permissionsOutput = await adbClient
    .shellCommand(device.id, ['dumpsys', 'package', request.packageName])
    .catch(() => '')
  const permissions = parsePackageRequestedPermissions(permissionsOutput, request.packageName)

  const provider = providers[settings.provider]()
  const result = await provider.analyzePackage(
    {
      manufacturer: device.manufacturer,
      model: device.model,
      androidVersion: device.androidVersion,
      packageName: request.packageName,
      appLabel: request.displayName,
      versionName: request.versionName,
      isSystemApp: request.isSystemApp,
      permissions
    },
    { apiKey, model: settings.model, baseUrl: settings.baseUrl }
  )

  return { text: result.text, model: result.model, provider: settings.provider }
}
