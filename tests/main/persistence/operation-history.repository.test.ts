import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '@main/persistence/migrations'
import {
  getLatestSuccessfulOperationPerPackage,
  recordOperation
} from '@main/persistence/operation-history.repository'

const SERIAL = 'R5CY73MF2QL'

describe('getLatestSuccessfulOperationPerPackage', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns only the most recent successful entry for each package', () => {
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
    recordOperation(db, {
      deviceId: SERIAL,
      packageName: 'com.example.b',
      operation: 'uninstall-for-user',
      previousState: 'installed for this user',
      newState: 'not installed for this user',
      success: true,
      rawOutput: 'ok'
    })

    const latest = getLatestSuccessfulOperationPerPackage(db, SERIAL)

    expect(latest).toHaveLength(2)
    expect(latest.find((entry) => entry.packageName === 'com.example.a')?.operation).toBe('enable')
    expect(latest.find((entry) => entry.packageName === 'com.example.b')?.operation).toBe(
      'uninstall-for-user'
    )
  })

  it('ignores failed operations entirely, falling back to the last successful one', () => {
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
      newState: 'disabled',
      success: false,
      rawOutput: 'device rejected it'
    })

    const latest = getLatestSuccessfulOperationPerPackage(db, SERIAL)

    expect(latest).toHaveLength(1)
    expect(latest[0]?.operation).toBe('disable')
  })

  it('scopes strictly to the given device', () => {
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
      deviceId: 'SOME_OTHER_SERIAL',
      packageName: 'com.example.a',
      operation: 'clear-data',
      previousState: null,
      newState: null,
      success: true,
      rawOutput: 'ok'
    })

    const latest = getLatestSuccessfulOperationPerPackage(db, SERIAL)

    expect(latest).toHaveLength(1)
    expect(latest[0]?.deviceId).toBe(SERIAL)
    expect(latest[0]?.operation).toBe('disable')
  })
})
