import { extractApiErrorMessage, postJson } from './http-post-json'
import { buildAnalysisPrompt } from './prompt'
import type {
  AiAnalysisResult,
  AiProvider,
  AiProviderConfig,
  PackageAiAnalysisInput
} from './ai-provider'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

interface AnthropicResponseBody {
  content?: Array<{ type: string; text?: string }>
}

/** `post` is injected (defaulting to the real `postJson`) purely so tests
 *  can verify the request shape and response parsing without needing
 *  Electron's `net` module — mirrors the same pattern
 *  `platform-tools-manager.ts` uses for its own download function. */
export class AnthropicProvider implements AiProvider {
  constructor(private readonly post: typeof postJson = postJson) {}

  async analyzePackage(
    input: PackageAiAnalysisInput,
    config: AiProviderConfig
  ): Promise<AiAnalysisResult> {
    const response = await this.post(
      ANTHROPIC_API_URL,
      {
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      {
        model: config.model,
        max_tokens: 500,
        messages: [{ role: 'user', content: buildAnalysisPrompt(input) }]
      }
    )

    if (response.statusCode !== 200) {
      throw new Error(
        extractApiErrorMessage(response.body) ??
          `Anthropic API returned HTTP ${response.statusCode}.`
      )
    }

    const parsed = JSON.parse(response.body) as AnthropicResponseBody
    const text = parsed.content?.find((block) => block.type === 'text')?.text?.trim()
    if (!text) {
      throw new Error('Anthropic API returned an empty response.')
    }
    return { text, model: config.model }
  }
}
