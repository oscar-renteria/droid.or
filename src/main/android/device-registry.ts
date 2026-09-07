import type Database from 'better-sqlite3'
import type { KnownDevice, DeviceConnectionState } from '@shared/validation/device.schema'
import type { AdbClient } from '../adb/adb-client'
import { isValidAdbSerial } from '../adb/adb-serial'
import type { RawAdbDevice } from '../adb/device-list-parser'
import {
  clearDeviceHistory,
  listDevices,
  removeDevice as removeDeviceRow,
  renameDevice as renameDeviceRow,
  upsertDeviceSeen
} from '../persistence/devices.repository'

const WATCH_RESTART_DELAY_MS = 2000

const STATE_PRIORITY: Record<DeviceConnectionState, number> = {
  device: 0,
  authorizing: 1,
  unauthorized: 2,
  sideload: 3,
  recovery: 4,
  offline: 5,
  'no-permissions': 6,
  disconnected: 7
}

/**
 * Merges the live adb track-devices snapshot with persisted device history
 * into the single list the UI renders, and is the only thing in the app
 * that decides when a device's identity gets written to the database.
 * connectionState itself is never persisted — it's recomputed from the live
 * snapshot on every change, so a stale "connected" status can't survive an
 * app restart.
 */
export class DeviceRegistry {
  private readonly listeners = new Set<(devices: KnownDevice[]) => void>()
  private readonly enrichingSerials = new Set<string>()
  private latestRaw: RawAdbDevice[] = []
  private stopWatching: (() => void) | null = null
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  constructor(
    private readonly db: Database.Database,
    private readonly adbClient: AdbClient
  ) {}

  start(): void {
    this.stopped = false
    this.beginWatch()
  }

  stop(): void {
    this.stopped = true
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    this.stopWatching?.()
    this.stopWatching = null
  }

  onDevicesChanged(listener: (devices: KnownDevice[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getCurrentDevices(): KnownDevice[] {
    return this.buildMergedList()
  }

  renameDevice(id: string, nickname: string | null): void {
    renameDeviceRow(this.db, id, nickname)
    this.emitChange()
  }

  /** No-ops for a currently attached device: it would simply reappear as
   *  "known" on the very next snapshot, so silently refusing is more honest
   *  than a delete that doesn't stick. */
  removeDevice(id: string): void {
    const attachedIds = new Set(
      this.latestRaw.map((d) => d.serial).filter((s): s is string => s !== null)
    )
    if (attachedIds.has(id)) {
      return
    }
    removeDeviceRow(this.db, id)
    this.emitChange()
  }

  clearHistory(): void {
    const attachedIds = this.latestRaw.map((d) => d.serial).filter((s): s is string => s !== null)
    clearDeviceHistory(this.db, attachedIds)
    this.emitChange()
  }

  private beginWatch(): void {
    this.stopWatching = this.adbClient.watchDevices(
      (devices) => this.handleSnapshot(devices),
      () => this.handleWatchError()
    )
  }

  private handleWatchError(): void {
    this.stopWatching = null
    if (this.stopped) {
      return
    }
    // adb track-devices shouldn't exit on its own; if it does (adb server
    // restarted, device driver hiccup, ...) keep retrying rather than
    // leaving the device list frozen for the rest of the app session.
    this.restartTimer = setTimeout(() => this.beginWatch(), WATCH_RESTART_DELAY_MS)
  }

  private handleSnapshot(devices: RawAdbDevice[]): void {
    this.latestRaw = devices
    this.emitChange()
    this.enrichAuthorizedDevices(devices)
  }

  private enrichAuthorizedDevices(devices: RawAdbDevice[]): void {
    for (const device of devices) {
      const serial = device.serial
      if (
        device.state !== 'device' ||
        !serial ||
        !isValidAdbSerial(serial) ||
        this.enrichingSerials.has(serial)
      ) {
        continue
      }

      this.enrichingSerials.add(serial)
      this.adbClient
        .getDeviceProperties(serial)
        .then((properties) => {
          const sdkVersionRaw = properties.get('ro.build.version.sdk')
          const sdkVersion = sdkVersionRaw ? Number.parseInt(sdkVersionRaw, 10) : null
          upsertDeviceSeen(
            this.db,
            {
              id: serial,
              manufacturer: properties.get('ro.product.manufacturer') ?? null,
              model: properties.get('ro.product.model') ?? null,
              androidVersion: properties.get('ro.build.version.release') ?? null,
              sdkVersion: sdkVersion !== null && Number.isFinite(sdkVersion) ? sdkVersion : null
            },
            new Date().toISOString()
          )
          this.emitChange()
        })
        .catch(() => {
          // Transient failure (device dropped mid-query, etc.) — the next
          // snapshot that still shows this device authorized will retry.
        })
        .finally(() => {
          this.enrichingSerials.delete(serial)
        })
    }
  }

  private emitChange(): void {
    const merged = this.buildMergedList()
    for (const listener of this.listeners) {
      listener(merged)
    }
  }

  private buildMergedList(): KnownDevice[] {
    const persisted = listDevices(this.db)
    const persistedById = new Map(persisted.map((row) => [row.id, row]))
    const attachedIds = new Set<string>()
    const nowIso = new Date().toISOString()
    const result: KnownDevice[] = []
    let noPermissionsCounter = 0

    for (const raw of this.latestRaw) {
      if (!raw.serial) {
        result.push({
          id: `no-permissions-${noPermissionsCounter++}`,
          nickname: null,
          manufacturer: null,
          model: null,
          androidVersion: null,
          sdkVersion: null,
          connectionState: 'no-permissions',
          firstSeenAt: nowIso,
          lastConnectedAt: null
        })
        continue
      }

      attachedIds.add(raw.serial)
      const known = persistedById.get(raw.serial)
      const fallbackModel = raw.properties.model ? raw.properties.model.replace(/_/g, ' ') : null

      result.push({
        id: raw.serial,
        nickname: known?.nickname ?? null,
        manufacturer: known?.manufacturer ?? null,
        model: known?.model ?? fallbackModel,
        androidVersion: known?.androidVersion ?? null,
        sdkVersion: known?.sdkVersion ?? null,
        connectionState: raw.state,
        firstSeenAt: known?.firstSeenAt ?? nowIso,
        lastConnectedAt: known?.lastConnectedAt ?? null
      })
    }

    for (const row of persisted) {
      if (attachedIds.has(row.id)) {
        continue
      }
      result.push({
        id: row.id,
        nickname: row.nickname,
        manufacturer: row.manufacturer,
        model: row.model,
        androidVersion: row.androidVersion,
        sdkVersion: row.sdkVersion,
        connectionState: 'disconnected',
        firstSeenAt: row.firstSeenAt,
        lastConnectedAt: row.lastConnectedAt
      })
    }

    return result.sort((a, b) => {
      const priorityDiff = STATE_PRIORITY[a.connectionState] - STATE_PRIORITY[b.connectionState]
      if (priorityDiff !== 0) {
        return priorityDiff
      }
      return (b.lastConnectedAt ?? '').localeCompare(a.lastConnectedAt ?? '')
    })
  }
}
