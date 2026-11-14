import { net } from 'electron'
import type { HttpJsonResponse } from './update-check.service'

const REQUEST_TIMEOUT_MS = 10_000

/**
 * GETs a small JSON document via Electron's `net` (honours system proxy
 * settings, like the platform-tools download). Sends only the headers
 * GitHub's API requires — a generic User-Agent and the API media type —
 * and no identifying information.
 */
export function getJson(url: string): Promise<HttpJsonResponse> {
  return new Promise((resolve, reject) => {
    const request = net.request({ method: 'GET', url, redirect: 'error' })
    request.setHeader('Accept', 'application/vnd.github+json')
    request.setHeader('User-Agent', 'droid.or-update-check')

    const timer = setTimeout(() => {
      request.abort()
      reject(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS} ms`))
    }, REQUEST_TIMEOUT_MS)

    let body = ''
    request.on('response', (response) => {
      response.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf-8')
      })
      response.on('error', (error: Error) => {
        clearTimeout(timer)
        reject(error)
      })
      response.on('end', () => {
        clearTimeout(timer)
        resolve({ statusCode: response.statusCode, body })
      })
    })
    request.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    request.end()
  })
}
