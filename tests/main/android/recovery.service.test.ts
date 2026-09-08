import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDeviceChanges } from '@main/android/recovery.service'
import { runMigrations } from '@main/persistence/migrations'
import { recordOperation } from '@main/persistence/operation-history.repository'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'

describe('getDeviceChanges', () => {
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

  it('lists a package that is still disabled, as restorable', async () => {
    recordOperation(db, {
      deviceId: SERIAL,
      packageName: 'com.example.disabled',
      operation: 'disable',
      previousState: 'enabled',
      newState: 'disabled',
      success: true,
      rawOutput: 'ok'
    })
    adb.shellResponses.set(
      `${SERIAL}\npm list packages -d -u com.example.disabled`,
      'package:com.example.disabled'
    )

    const changes = await getDeviceChanges(db, adb, SERIAL)

    expect(changes.disabled).toEqual([
      {
        packageName: 'com.example.disabled',
        operation: 'disable',
        performedAt: expect.any(String),
        restorable: true,
        blockedReason: null
      }
    ])
    expect(changes.uninstalled).toEqual([])
    expect(changes.cleared).toEqual([])
  })

  it('excludes a package that was disabled but has since been re-enabled outside this app', async () => {
    recordOperation(db, {
      deviceId: SERIAL,
      packageName: 'com.example.disabled',
      operation: 'disable',
      previousState: 'enabled',
      newState: 'disabled',
      success: true,
      rawOutput: 'ok'
    })
    // The device now reports it as enabled — e.g. the user flipped it back
    // on from Settings, entirely outside this app's knowledge.
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u com.example.disabled`, '')

    const changes = await getDeviceChanges(db, adb, SERIAL)

    expect(changes.disabled).toEqual([])
  })

  it('excludes a package whose latest recorded action is a restore (enable)', async () => {
    recordOperation(db, {
      deviceId: SERIAL,
      packageName: 'com.example.a',
      operation: 'disable',
      previousState: 'enabled',
      newState: 'disabled',
      success: true,
      rawOutput: 'ok'
    })
    recordOperation(db, {
      deviceId: SERIAL,
      packageName: 'com.example.a',
      operation: 'enable',
      previousState: 'disabled',
      newState: 'enabled',
      success: true,
      rawOutput: 'ok'
    })

    const changes = await getDeviceChanges(db, adb, SERIAL)

    expect(changes.disabled).toEqual([])
    // No shell call for this package should even have been made — it was
    // filtered out purely from the history fold, before any live check.
    expect(adb.shellResponses.has(`${SERIAL}\npm list packages -d -u com.example.a`)).toBe(false)
  })

  it('marks a still-uninstalled system package as restorable when pm still knows about it', async () => {
    recordOperation(db, {
      deviceId: SERIAL,
      packageName: 'com.samsung.android.mhs.ai',
      operation: 'uninstall-for-user',
      previousState: 'installed for this user',
      newState: 'not installed for this user',
      success: true,
      rawOutput: 'ok'
    })
    adb.shellResponses.set(`${SERIAL}\npm list packages com.samsung.android.mhs.ai`, '')
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u com.samsung.android.mhs.ai`, '')
    adb.shellResponses.set(
      `${SERIAL}\npm list packages -u com.samsung.android.mhs.ai`,
      'package:com.samsung.android.mhs.ai'
    )

    const changes = await getDeviceChanges(db, adb, SERIAL)

    expect(changes.uninstalled).toEqual([
      {
        packageName: 'com.samsung.android.mhs.ai',
        operation: 'uninstall-for-user',
        performedAt: expect.any(String),
        restorable: true,
        blockedReason: null
      }
    ])
  })

  it('marks a fully-gone package as not restorable, with an explanation', async () => {
    recordOperation(db, {
      deviceId: SERIAL,
      packageName: 'com.example.gone',
      operation: 'uninstall-for-user',
      previousState: 'installed for this user',
      newState: 'not installed for this user',
      success: true,
      rawOutput: 'ok'
    })
    adb.shellResponses.set(`${SERIAL}\npm list packages com.example.gone`, '')
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u com.example.gone`, '')
    adb.shellResponses.set(`${SERIAL}\npm list packages -u com.example.gone`, '')

    const changes = await getDeviceChanges(db, adb, SERIAL)

    expect(changes.uninstalled).toHaveLength(1)
    expect(changes.uninstalled[0]?.restorable).toBe(false)
    expect(changes.uninstalled[0]?.blockedReason).toMatch(/completely removed/)
  })

  it('always lists cleared packages, with no restorability check at all', async () => {
    recordOperation(db, {
      deviceId: SERIAL,
      packageName: 'com.example.cleared',
      operation: 'clear-data',
      previousState: null,
      newState: null,
      success: true,
      rawOutput: 'Success'
    })

    const changes = await getDeviceChanges(db, adb, SERIAL)

    expect(changes.cleared).toEqual([
      { packageName: 'com.example.cleared', performedAt: expect.any(String) }
    ])
  })
})
