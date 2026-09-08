import { extractApiErrorMessage, postJson } from './http-post-json'
import { buildAnalysisPrompt } from './prompt'
import type {
  AiAnalysisResult,
  AiProvider,
  AiProviderConfig,
  PackageAiAnalysisInput
} from './ai-provider'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

interface OpenAiResponseBody {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * Targets any Chat Completions-shaped endpoint (OpenAI itself, Azure
 * OpenAI, or a self-hosted OpenAI-compatible proxy) via a configurable
 * base URL, defaulting to OpenAI's own API when none is set. `post` is
 * injected the same way `AnthropicProvider` does, for the same reason.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  constructor(private readonly post: typeof postJson = postJson) {}

  async analyzePackage(
    input: PackageAiAnalysisInput,
    config: AiProviderConfig
  ): Promise<AiAnalysisResult> {
    const baseUrl = (config.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
    const response = await this.post(
      `${baseUrl}/chat/completions`,
      { Authorization: `Bearer ${config.apiKey}` },
      {
        model: config.model,
        messages: [{ role: 'user', content: buildAnalysisPrompt(input) }]
      }
    )

    if (response.statusCode !== 200) {
      throw new Error(
        extractApiErrorMessage(response.body) ?? `The API returned HTTP ${response.statusCode}.`
      )
    }

    const parsed = JSON.parse(response.body) as OpenAiResponseBody
    const text = parsed.choices?.[0]?.message?.content?.trim()
    if (!text) {
      throw new Error('The API returned an empty response.')
    }
    return { text, model: config.model }
  }
}
