import type Database from 'better-sqlite3'

export interface PersistedDevice {
  id: string
  nickname: string | null
  manufacturer: string | null
  model: string | null
  androidVersion: string | null
  sdkVersion: number | null
  firstSeenAt: string
  lastConnectedAt: string | null
}

interface DeviceRow {
  id: string
  nickname: string | null
  manufacturer: string | null
  model: string | null
  android_version: string | null
  sdk_version: number | null
  first_seen_at: string
  last_connected_at: string | null
}

function toPersistedDevice(row: DeviceRow): PersistedDevice {
  return {
    id: row.id,
    nickname: row.nickname,
    manufacturer: row.manufacturer,
    model: row.model,
    androidVersion: row.android_version,
    sdkVersion: row.sdk_version,
    firstSeenAt: row.first_seen_at,
    lastConnectedAt: row.last_connected_at
  }
}

export interface DeviceSeenInfo {
  id: string
  manufacturer: string | null
  model: string | null
  androidVersion: string | null
  sdkVersion: number | null
}

/**
 * Records that a device successfully authorized and connected. Only called
 * for devices that reach the 'device' state — history is for devices this
 * app actually got to talk to, not every unauthorized USB blip. Identity
 * fields use COALESCE against the existing row so a value we couldn't read
 * this time (e.g. a getprop call that failed) never overwrites a previously
 * known one, and an existing nickname is never touched here.
 */
export function upsertDeviceSeen(
  db: Database.Database,
  info: DeviceSeenInfo,
  nowIso: string
): void {
  db.prepare(
    `
    INSERT INTO devices (id, nickname, manufacturer, model, android_version, sdk_version, first_seen_at, last_connected_at)
    VALUES (@id, NULL, @manufacturer, @model, @androidVersion, @sdkVersion, @now, @now)
    ON CONFLICT(id) DO UPDATE SET
      manufacturer = COALESCE(excluded.manufacturer, devices.manufacturer),
      model = COALESCE(excluded.model, devices.model),
      android_version = COALESCE(excluded.android_version, devices.android_version),
      sdk_version = COALESCE(excluded.sdk_version, devices.sdk_version),
      last_connected_at = @now
    `
  ).run({
    id: info.id,
    manufacturer: info.manufacturer,
    model: info.model,
    androidVersion: info.androidVersion,
    sdkVersion: info.sdkVersion,
    now: nowIso
  })
}

export function listDevices(db: Database.Database): PersistedDevice[] {
  const rows = db
    .prepare('SELECT * FROM devices ORDER BY last_connected_at DESC')
    .all() as DeviceRow[]
  return rows.map(toPersistedDevice)
}

export function renameDevice(db: Database.Database, id: string, nickname: string | null): void {
  db.prepare('UPDATE devices SET nickname = ? WHERE id = ?').run(nickname, id)
}

export function removeDevice(db: Database.Database, id: string): void {
  db.prepare('DELETE FROM devices WHERE id = ?').run(id)
}

/** Clears every device from history except those in `keepIds` (the ones
 *  currently attached — clearing history should not erase a device that's
 *  sitting right there plugged in). */
export function clearDeviceHistory(db: Database.Database, keepIds: readonly string[]): void {
  if (keepIds.length === 0) {
    db.exec('DELETE FROM devices')
    return
  }
  const placeholders = keepIds.map(() => '?').join(', ')
  db.prepare(`DELETE FROM devices WHERE id NOT IN (${placeholders})`).run(...keepIds)
}
