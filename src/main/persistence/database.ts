import Database from 'better-sqlite3'
import { runMigrations } from './migrations'

/**
 * Opens (creating if necessary) the app database and brings its schema up
 * to date. WAL mode is enabled because the renderer can trigger reads while
 * a device-list update is mid-write from the track-devices watcher; WAL
 * lets those not block each other the way the default rollback journal would.
 */
export function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}
