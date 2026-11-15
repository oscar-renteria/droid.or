import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupPathFor, openDatabase } from '@main/persistence/database'
import type { Migration } from '@main/persistence/migrations'

const V1: Migration = {
  version: 1,
  up: (db) => {
    db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)')
  }
}
const V2: Migration = {
  version: 2,
  up: (db) => {
    db.exec('ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0')
  }
}
/** Commits a destructive change; only a backup can undo it once a later
 *  migration fails (each migration's transaction covers only itself). */
const V3_DESTRUCTIVE: Migration = {
  version: 3,
  up: (db) => {
    db.exec('DELETE FROM notes')
  }
}
const V4_BROKEN: Migration = {
  version: 4,
  up: () => {
    throw new Error('migration 4 exploded')
  }
}

describe('openDatabase', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'droid-or-db-'))
    file = join(dir, 'droid-or.db')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function seedAtV2(): void {
    const db = openDatabase(file, [V1, V2])
    db.prepare('INSERT INTO notes (body) VALUES (?)').run('keep me')
    db.close()
  }

  const backups = () => readdirSync(dir).filter((name) => name.includes('.backup-v'))

  it('creates a fresh database without a backup', () => {
    openDatabase(file, [V1, V2]).close()
    expect(backups()).toEqual([])
  })

  it('backs up an existing database before upgrading it', () => {
    openDatabase(file, [V1]).close()
    const db = openDatabase(file, [V1, V2])
    expect(db.pragma('user_version', { simple: true })).toBe(2)
    db.close()

    expect(backups()).toEqual(['droid-or.backup-v1.db'])
    const backup = new Database(backupPathFor(file, 1), { readonly: true })
    expect(backup.pragma('user_version', { simple: true })).toBe(1)
    backup.close()
  })

  it('does not back up when the schema is already current', () => {
    seedAtV2()
    openDatabase(file, [V1, V2]).close()
    expect(backups()).toEqual([])
  })

  it('restores the backup and rethrows when a migration fails', () => {
    seedAtV2()

    expect(() => openDatabase(file, [V1, V2, V3_DESTRUCTIVE, V4_BROKEN])).toThrow(
      /schema version 2 failed and the previous database was restored .*migration 4 exploded/
    )

    const db = new Database(file)
    expect(db.pragma('user_version', { simple: true })).toBe(2)
    expect(db.prepare('SELECT body FROM notes').all()).toEqual([{ body: 'keep me' }])
    db.close()
    expect(existsSync(backupPathFor(file, 2))).toBe(true)
  })

  it('keeps only the two newest backups', () => {
    const steps: Migration[] = [V1]
    openDatabase(file, steps).close()
    for (let version = 2; version <= 5; version++) {
      steps.push({ version, up: () => {} })
      openDatabase(file, steps).close()
    }
    expect(backups().sort()).toEqual(['droid-or.backup-v3.db', 'droid-or.backup-v4.db'])
  })
})
