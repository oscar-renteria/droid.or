import { copyFileSync, readdirSync, rmSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { getSchemaVersion, hasPendingMigrations, MIGRATIONS, runMigrations } from './migrations'
import type { Migration } from './migrations'

/** Backups kept per database; older ones are deleted after a new one. */
const BACKUPS_TO_KEEP = 2

export function backupPathFor(filePath: string, schemaVersion: number): string {
  return join(dirname(filePath), `${basename(filePath, '.db')}.backup-v${schemaVersion}.db`)
}

/**
 * Opens (creating if necessary) the app database and brings its schema up
 * to date. WAL mode is enabled because the renderer can trigger reads while
 * a device-list update is mid-write from the track-devices watcher; WAL
 * lets those not block each other the way the default rollback journal would.
 *
 * Before upgrading an existing database, a consistent copy is written next
 * to it (`droid-or.backup-v<old version>.db`). If any migration fails, that
 * copy is restored — the database is never left half-upgraded, and the
 * previous app version can still open it — and the error is rethrown so
 * startup fails loudly (see crash-handlers.ts).
 */
export function openDatabase(
  filePath: string,
  migrations: readonly Migration[] = MIGRATIONS
): Database.Database {
  let db = open(filePath)
  const fromVersion = getSchemaVersion(db)
  if (fromVersion === 0 || !hasPendingMigrations(db, migrations)) {
    runMigrations(db, migrations)
    return db
  }

  const backupPath = backupPathFor(filePath, fromVersion)
  rmSync(backupPath, { force: true })
  // VACUUM INTO writes a transactionally consistent copy, WAL included.
  db.prepare('VACUUM INTO ?').run(backupPath)

  try {
    runMigrations(db, migrations)
  } catch (error) {
    db.close()
    restore(backupPath, filePath)
    db = open(filePath)
    db.close()
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Upgrading the database from schema version ${fromVersion} failed and the previous ` +
        `database was restored from ${backupPath}: ${reason}`,
      { cause: error }
    )
  }

  pruneBackups(filePath)
  return db
}

function open(filePath: string): Database.Database {
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

function restore(backupPath: string, filePath: string): void {
  // Stale WAL/SHM files from the failed run must not be replayed onto the
  // restored copy.
  rmSync(`${filePath}-wal`, { force: true })
  rmSync(`${filePath}-shm`, { force: true })
  copyFileSync(backupPath, filePath)
}

function pruneBackups(filePath: string): void {
  const directory = dirname(filePath)
  const prefix = `${basename(filePath, '.db')}.backup-v`
  const backups = readdirSync(directory)
    .map((name) => ({ name, version: Number(name.slice(prefix.length, -'.db'.length)) }))
    .filter(({ name, version }) => name.startsWith(prefix) && Number.isInteger(version))
    .sort((a, b) => b.version - a.version)
  for (const { name } of backups.slice(BACKUPS_TO_KEEP)) {
    rmSync(join(directory, name), { force: true })
  }
}
