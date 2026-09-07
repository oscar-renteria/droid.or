import type Database from 'better-sqlite3'

/** Global, not per-device: "never recommend this package" is a preference
 *  about the package itself (spec §15), and most OEM package names are
 *  already manufacturer-specific, so there is little to gain from scoping
 *  this per device and it keeps the model simple. */
export function getIgnoredPackages(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT package_name FROM ignored_packages').all() as Array<{
    package_name: string
  }>
  return new Set(rows.map((row) => row.package_name))
}

export function setPackageIgnored(
  db: Database.Database,
  packageName: string,
  ignored: boolean
): void {
  if (ignored) {
    db.prepare(
      'INSERT INTO ignored_packages (package_name, ignored_at) VALUES (?, ?) ON CONFLICT(package_name) DO NOTHING'
    ).run(packageName, new Date().toISOString())
  } else {
    db.prepare('DELETE FROM ignored_packages WHERE package_name = ?').run(packageName)
  }
}
