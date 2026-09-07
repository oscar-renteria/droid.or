import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '@main/persistence/migrations'
import { getSetting, setSetting } from '@main/persistence/settings.repository'

describe('settings.repository', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns null for a key that was never set', () => {
    expect(getSetting(db, 'adb_custom_path')).toBeNull()
  })

  it('stores and retrieves a value', () => {
    setSetting(db, 'adb_custom_path', '/usr/bin/adb')
    expect(getSetting(db, 'adb_custom_path')).toBe('/usr/bin/adb')
  })

  it('overwrites an existing value for the same key', () => {
    setSetting(db, 'adb_custom_path', '/usr/bin/adb')
    setSetting(db, 'adb_custom_path', '/opt/platform-tools/adb')
    expect(getSetting(db, 'adb_custom_path')).toBe('/opt/platform-tools/adb')
  })

  it('deletes the key when set to null', () => {
    setSetting(db, 'adb_custom_path', '/usr/bin/adb')
    setSetting(db, 'adb_custom_path', null)
    expect(getSetting(db, 'adb_custom_path')).toBeNull()
  })
})
