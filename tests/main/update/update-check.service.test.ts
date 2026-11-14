import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runMigrations } from '@main/persistence/migrations'
import {
  CHECK_INTERVAL_MS,
  LATEST_RELEASE_API_URL,
  UpdateCheckService,
  type FetchJson
} from '@main/update/update-check.service'

const RELEASES = 'https://github.com/oscar-renteria/droid.or/releases'

function release(tag: string) {
  return { statusCode: 200, body: JSON.stringify({ tag_name: tag, html_url: 'https://evil.test' }) }
}

describe('UpdateCheckService', () => {
  let db: Database.Database
  let now: number
  let fetchJson: ReturnType<typeof vi.fn<FetchJson>>

  const service = (currentVersion = '1.0.0') =>
    new UpdateCheckService(db, fetchJson, currentVersion, () => now)

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    now = 1_000_000_000_000
    fetchJson = vi.fn<FetchJson>()
  })

  afterEach(() => {
    db.close()
  })

  it('reports a newer release with a URL built from the tag, not the response', async () => {
    fetchJson.mockResolvedValue(release('v1.1.0'))
    await expect(service().getStatus()).resolves.toEqual({
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateAvailable: true,
      releaseUrl: `${RELEASES}/tag/v1.1.0`,
      checkedAt: now,
      checkEnabled: true
    })
    expect(fetchJson).toHaveBeenCalledExactlyOnceWith(LATEST_RELEASE_API_URL)
  })

  it('reports no update for the same or an older release', async () => {
    fetchJson.mockResolvedValue(release('v1.0.0'))
    expect((await service().getStatus()).updateAvailable).toBe(false)

    now += CHECK_INTERVAL_MS
    fetchJson.mockResolvedValue(release('v0.9.0'))
    expect((await service().getStatus()).updateAvailable).toBe(false)
  })

  it('tells a prerelease user about the matching stable release', async () => {
    fetchJson.mockResolvedValue(release('v1.0.0'))
    expect((await service('1.0.0-beta.1').getStatus()).updateAvailable).toBe(true)
  })

  it('checks at most once per interval', async () => {
    fetchJson.mockResolvedValue(release('v1.1.0'))
    await service().getStatus()
    now += CHECK_INTERVAL_MS - 1
    await service().getStatus()
    expect(fetchJson).toHaveBeenCalledOnce()

    now += 1
    await service().getStatus()
    expect(fetchJson).toHaveBeenCalledTimes(2)
  })

  it('returns an empty status when offline and retries next time', async () => {
    fetchJson.mockRejectedValue(new Error('net::ERR_INTERNET_DISCONNECTED'))
    await expect(service().getStatus()).resolves.toMatchObject({
      latestVersion: null,
      updateAvailable: false,
      releaseUrl: null,
      checkedAt: null
    })
    await service().getStatus()
    expect(fetchJson).toHaveBeenCalledTimes(2)
  })

  it('keeps the last known result when rate-limited', async () => {
    fetchJson.mockResolvedValue(release('v1.1.0'))
    await service().getStatus()

    now += CHECK_INTERVAL_MS
    fetchJson.mockResolvedValue({ statusCode: 403, body: '{"message":"API rate limit exceeded"}' })
    await expect(service().getStatus()).resolves.toMatchObject({
      latestVersion: '1.1.0',
      updateAvailable: true,
      checkedAt: now - CHECK_INTERVAL_MS
    })
  })

  it('ignores a malformed payload or tag', async () => {
    fetchJson.mockResolvedValueOnce({ statusCode: 200, body: 'not json' })
    expect((await service().getStatus()).latestVersion).toBeNull()

    fetchJson.mockResolvedValueOnce(release('nightly-2026-11-14'))
    expect((await service().getStatus()).latestVersion).toBeNull()
  })

  it('makes no request and reports no update while disabled', async () => {
    fetchJson.mockResolvedValue(release('v1.1.0'))
    await service().getStatus()
    now += CHECK_INTERVAL_MS

    const disabled = await service().setEnabled(false)
    expect(disabled).toMatchObject({ checkEnabled: false, updateAvailable: false })
    await service().getStatus()
    expect(fetchJson).toHaveBeenCalledOnce()
  })

  it('checks right away when re-enabled', async () => {
    await service().setEnabled(false)
    fetchJson.mockResolvedValue(release('v1.1.0'))
    await expect(service().setEnabled(true)).resolves.toMatchObject({
      checkEnabled: true,
      updateAvailable: true
    })
    expect(fetchJson).toHaveBeenCalledOnce()
  })
})
