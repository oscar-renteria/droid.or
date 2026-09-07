import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppMetadataService } from '@main/android/app-metadata.service'
import { runMigrations } from '@main/persistence/migrations'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'

describe('AppMetadataService', () => {
  let db: Database.Database
  let adb: FakeAdbClient

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    adb = new FakeAdbClient()
  })

  afterEach(() => {
    db.close()
  })

  it('pulls, extracts, and caches metadata on a cache miss', async () => {
    let extractCallCount = 0
    const service = new AppMetadataService(db, adb, async (path) => {
      extractCallCount += 1
      expect(path).toMatch(/droid-or-.*\.apk$/)
      return { label: 'Waze', iconDataUrl: 'data:image/webp;base64,AAAA' }
    })

    const result = await service.getMetadata({
      serial: SERIAL,
      packageName: 'com.waze',
      apkPath: '/data/app/com.waze/base.apk',
      versionCode: 123
    })

    expect(result).toEqual({ label: 'Waze', iconDataUrl: 'data:image/webp;base64,AAAA' })
    expect(extractCallCount).toBe(1)
    expect(adb.pullCalls).toHaveLength(1)
    expect(adb.pullCalls[0]?.remotePath).toBe('/data/app/com.waze/base.apk')
  })

  it('returns cached metadata on a second call without pulling again', async () => {
    let extractCallCount = 0
    const service = new AppMetadataService(db, adb, async () => {
      extractCallCount += 1
      return { label: 'Waze', iconDataUrl: null }
    })

    const request = {
      serial: SERIAL,
      packageName: 'com.waze',
      apkPath: '/data/app/com.waze/base.apk',
      versionCode: 123
    }

    await service.getMetadata(request)
    await service.getMetadata(request)

    expect(extractCallCount).toBe(1)
    expect(adb.pullCalls).toHaveLength(1)
  })

  it('does not cache when versionCode is null (no reliable invalidation key)', async () => {
    let extractCallCount = 0
    const service = new AppMetadataService(db, adb, async () => {
      extractCallCount += 1
      return { label: 'Something', iconDataUrl: null }
    })

    const request = {
      serial: SERIAL,
      packageName: 'com.unknown',
      apkPath: '/data/app/com.unknown/base.apk',
      versionCode: null
    }

    await service.getMetadata(request)
    await service.getMetadata(request)

    expect(extractCallCount).toBe(2)
  })

  it('de-duplicates concurrent requests for the same package and version', async () => {
    let extractCallCount = 0
    const service = new AppMetadataService(db, adb, async () => {
      extractCallCount += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { label: 'Waze', iconDataUrl: null }
    })

    const request = {
      serial: SERIAL,
      packageName: 'com.waze',
      apkPath: '/data/app/com.waze/base.apk',
      versionCode: 123
    }

    const [first, second] = await Promise.all([
      service.getMetadata(request),
      service.getMetadata(request)
    ])

    expect(extractCallCount).toBe(1)
    expect(first).toEqual(second)
  })

  it('degrades to nulls (not a thrown error) when the pull itself fails', async () => {
    adb.pullResponses.set(`${SERIAL}\n/data/app/broken/base.apk`, new Error('device disconnected'))
    const service = new AppMetadataService(db, adb, async () => {
      throw new Error('should not be called if pull failed')
    })

    const result = await service.getMetadata({
      serial: SERIAL,
      packageName: 'com.broken',
      apkPath: '/data/app/broken/base.apk',
      versionCode: 1
    })

    expect(result).toEqual({ label: null, iconDataUrl: null })
  })
})
