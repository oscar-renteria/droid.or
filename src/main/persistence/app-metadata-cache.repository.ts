import type Database from 'better-sqlite3'
import type { ApkMetadata } from '../android/apk-metadata-extractor'

interface CacheRow {
  label: string | null
  icon_data_url: string | null
}

/** Cached by (packageName, versionCode) — not per device, since the same
 *  app version has the same label/icon regardless of which phone it came
 *  from. Extracting a label/icon means pulling and parsing the whole APK,
 *  which is too expensive to redo on every app launch or device reselect. */
export function getCachedAppMetadata(
  db: Database.Database,
  packageName: string,
  versionCode: number
): ApkMetadata | null {
  const row = db
    .prepare(
      'SELECT label, icon_data_url FROM app_metadata_cache WHERE package_name = ? AND version_code = ?'
    )
    .get(packageName, versionCode) as CacheRow | undefined

  return row ? { label: row.label, iconDataUrl: row.icon_data_url } : null
}

export function setCachedAppMetadata(
  db: Database.Database,
  packageName: string,
  versionCode: number,
  metadata: ApkMetadata
): void {
  db.prepare(
    `
    INSERT INTO app_metadata_cache (package_name, version_code, label, icon_data_url, cached_at)
    VALUES (@packageName, @versionCode, @label, @iconDataUrl, @now)
    ON CONFLICT(package_name, version_code) DO UPDATE SET
      label = excluded.label,
      icon_data_url = excluded.icon_data_url,
      cached_at = excluded.cached_at
    `
  ).run({
    packageName,
    versionCode,
    label: metadata.label,
    iconDataUrl: metadata.iconDataUrl,
    now: new Date().toISOString()
  })
}
