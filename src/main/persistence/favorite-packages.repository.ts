import type Database from 'better-sqlite3'

/** Global, not per-device — same reasoning as ignored_packages (spec §15):
 *  "important" is a preference about the package itself, not a specific
 *  device, and most OEM package names are already manufacturer-specific. */
export function getFavoritePackages(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT package_name FROM favorite_packages').all() as Array<{
    package_name: string
  }>
  return new Set(rows.map((row) => row.package_name))
}

export function setPackageFavorite(
  db: Database.Database,
  packageName: string,
  favorite: boolean
): void {
  if (favorite) {
    db.prepare(
      'INSERT INTO favorite_packages (package_name, favorited_at) VALUES (?, ?) ON CONFLICT(package_name) DO NOTHING'
    ).run(packageName, new Date().toISOString())
  } else {
    db.prepare('DELETE FROM favorite_packages WHERE package_name = ?').run(packageName)
  }
}
