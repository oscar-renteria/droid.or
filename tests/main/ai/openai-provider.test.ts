import { describe, expect, it, vi } from 'vitest'
import { OpenAiCompatibleProvider } from '@main/ai/openai-provider'
import type { JsonPostResponse } from '@main/ai/http-post-json'

const INPUT = {
  manufacturer: 'Google',
  model: 'Pixel 9',
  androidVersion: '16',
  packageName: 'com.example.bloat',
  appLabel: 'Example Bloat',
  versionName: '2.0',
  isSystemApp: true,
  permissions: []
}
const CONFIG = { apiKey: 'sk-test', model: 'gpt-4o-mini', baseUrl: null }

describe('OpenAiCompatibleProvider', () => {
  it('posts to the default OpenAI endpoint when no base URL is configured', async () => {
    const post = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ choices: [{ message: { content: '  Probably fine to disable.  ' } }] })
    } satisfies JsonPostResponse)
    const provider = new OpenAiCompatibleProvider(post)

    const result = await provider.analyzePackage(INPUT, CONFIG)

    expect(result).toEqual({ text: 'Probably fine to disable.', model: 'gpt-4o-mini' })
    const [url, headers] = post.mock.calls[0] as [string, Record<string, string>, unknown]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(headers.Authorization).toBe('Bearer sk-test')
  })

  it('uses a configured base URL instead, stripping a trailing slash', async () => {
    const post = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] })
    } satisfies JsonPostResponse)
    const provider = new OpenAiCompatibleProvider(post)

    await provider.analyzePackage(INPUT, { ...CONFIG, baseUrl: 'https://my-proxy.example.com/v1/' })

    const [url] = post.mock.calls[0] as [string, Record<string, string>, unknown]
    expect(url).toBe('https://my-proxy.example.com/v1/chat/completions')
  })

  it('throws the API-provided error message on a non-200 response', async () => {
    const post = vi.fn().mockResolvedValue({
      statusCode: 429,
      body: JSON.stringify({ error: { message: 'rate limit exceeded' } })
    } satisfies JsonPostResponse)
    const provider = new OpenAiCompatibleProvider(post)

    await expect(provider.analyzePackage(INPUT, CONFIG)).rejects.toThrow('rate limit exceeded')
  })

  it('throws when the response has no message content', async () => {
    const post = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ choices: [] })
    } satisfies JsonPostResponse)
    const provider = new OpenAiCompatibleProvider(post)

    await expect(provider.analyzePackage(INPUT, CONFIG)).rejects.toThrow('empty response')
  })
})
