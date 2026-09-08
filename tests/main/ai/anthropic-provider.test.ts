import { describe, expect, it, vi } from 'vitest'
import { AnthropicProvider } from '@main/ai/anthropic-provider'
import type { JsonPostResponse } from '@main/ai/http-post-json'

const INPUT = {
  manufacturer: 'Samsung',
  model: 'SM-F766B',
  androidVersion: '16',
  packageName: 'com.samsung.android.aremoji',
  appLabel: 'AR Emoji',
  versionName: '1.0',
  isSystemApp: true,
  permissions: ['android.permission.CAMERA']
}
const CONFIG = { apiKey: 'sk-ant-test', model: 'claude-sonnet-5', baseUrl: null }

describe('AnthropicProvider', () => {
  it('posts to the Anthropic Messages API with the expected headers and body', async () => {
    const post = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ content: [{ type: 'text', text: '  This looks safe to remove.  ' }] })
    } satisfies JsonPostResponse)
    const provider = new AnthropicProvider(post)

    const result = await provider.analyzePackage(INPUT, CONFIG)

    expect(result).toEqual({ text: 'This looks safe to remove.', model: 'claude-sonnet-5' })
    expect(post).toHaveBeenCalledTimes(1)
    const [url, headers, body] = post.mock.calls[0] as [string, Record<string, string>, unknown]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(headers['x-api-key']).toBe('sk-ant-test')
    expect(headers['anthropic-version']).toBeTruthy()
    expect(body).toMatchObject({
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: expect.stringContaining('com.samsung.android.aremoji') }]
    })
  })

  it('throws the API-provided error message on a non-200 response', async () => {
    const post = vi.fn().mockResolvedValue({
      statusCode: 401,
      body: JSON.stringify({ error: { message: 'invalid x-api-key' } })
    } satisfies JsonPostResponse)
    const provider = new AnthropicProvider(post)

    await expect(provider.analyzePackage(INPUT, CONFIG)).rejects.toThrow('invalid x-api-key')
  })

  it('falls back to a generic HTTP-status error when the body is not the expected error shape', async () => {
    const post = vi
      .fn()
      .mockResolvedValue({ statusCode: 500, body: 'not json' } satisfies JsonPostResponse)
    const provider = new AnthropicProvider(post)

    await expect(provider.analyzePackage(INPUT, CONFIG)).rejects.toThrow('HTTP 500')
  })

  it('throws when the response has no text content block', async () => {
    const post = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ content: [] })
    } satisfies JsonPostResponse)
    const provider = new AnthropicProvider(post)

    await expect(provider.analyzePackage(INPUT, CONFIG)).rejects.toThrow('empty response')
  })
})
