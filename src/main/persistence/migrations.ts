import type Database from 'better-sqlite3'

interface Migration {
  /** Target `PRAGMA user_version`. Must be sequential starting at 1. */
  version: number
  up: (db: Database.Database) => void
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE devices (
          id TEXT PRIMARY KEY,
          nickname TEXT,
          manufacturer TEXT,
          model TEXT,
          android_version TEXT,
          sdk_version INTEGER,
          first_seen_at TEXT NOT NULL,
          last_connected_at TEXT
        )
      `)
    }
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE app_metadata_cache (
          package_name TEXT NOT NULL,
          version_code INTEGER NOT NULL,
          label TEXT,
          icon_data_url TEXT,
          cached_at TEXT NOT NULL,
          PRIMARY KEY (package_name, version_code)
        )
      `)
    }
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`
        CREATE TABLE ignored_packages (
          package_name TEXT PRIMARY KEY,
          ignored_at TEXT NOT NULL
        )
      `)
    }
  }
]

/**
 * Applies any migrations newer than the database's current
 * PRAGMA user_version, in order, each in its own transaction. Safe to call
 * on every app startup: a fully up-to-date database runs zero migrations.
 */
export function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) {
      continue
    }
    const applyMigration = db.transaction(() => {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    })
    applyMigration()
  }
}
