import type Database from 'better-sqlite3'

/** A small generic key/value store for app-level preferences that don't
 *  warrant their own table — currently just the ADB custom path override. */
export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    { value: string } | undefined
  return row?.value ?? null
}

/** Passing null deletes the key rather than storing an empty value, so
 *  getSetting reliably distinguishes "never set" from "set to empty". */
export function setSetting(db: Database.Database, key: string, value: string | null): void {
  if (value === null) {
    db.prepare('DELETE FROM app_settings WHERE key = ?').run(key)
    return
  }
  db.prepare(
    `
    INSERT INTO app_settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = @value
    `
  ).run({ key, value })
}
