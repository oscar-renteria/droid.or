import { net } from 'electron'

export interface JsonPostResponse {
  statusCode: number
  body: string
}

/**
 * POSTs a JSON body via Electron's `net.request` (the same module the
 * platform-tools downloader uses) and buffers the full response as text.
 * Every AI provider response here is a single small chat completion, so
 * buffering in memory is fine — unlike the multi-megabyte platform-tools
 * archive that download streams straight to disk instead.
 */
export function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<JsonPostResponse> {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'POST', url })
    request.setHeader('Content-Type', 'application/json')
    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value)
    }

    let responseBody = ''
    request.on('response', (response) => {
      response.on('data', (chunk: Buffer) => {
        responseBody += chunk.toString('utf-8')
      })
      response.on('error', reject)
      response.on('end', () => {
        resolve({ statusCode: response.statusCode, body: responseBody })
      })
    })
    request.on('error', reject)
    request.end(JSON.stringify(body))
  })
}

/** Best-effort extraction of a human-readable message from a JSON API
 *  error body shaped like `{ error: { message: "..." } }` — the common
 *  shape both Anthropic's and OpenAI's APIs use. Returns null rather than
 *  throwing if the body isn't JSON or doesn't match, so callers can fall
 *  back to a generic "HTTP <code>" message instead. */
export function extractApiErrorMessage(rawBody: string): string | null {
  try {
    const parsed = JSON.parse(rawBody) as { error?: { message?: string } | string }
    if (typeof parsed.error === 'string') {
      return parsed.error
    }
    return parsed.error?.message ?? null
  } catch {
    return null
  }
}
