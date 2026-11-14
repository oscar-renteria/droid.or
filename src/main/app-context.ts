import { app } from 'electron'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { RealAdbClient, type AdbClient } from './adb/adb-client'
import { AdbCommandLog } from './adb/adb-command-log'
import { AdbSettingsService, resolveEffectiveAdbCommand } from './adb/adb-settings.service'
import { LoggingAdbClient } from './adb/logging-adb-client'
import { AppMetadataService } from './android/app-metadata.service'
import { DeviceRegistry } from './android/device-registry'
import { openDatabase } from './persistence/database'
import type { FileLogger } from './logging/file-logger'
import { getJson } from './update/http-get-json'
import { UpdateCheckService } from './update/update-check.service'

export interface AppContext {
  db: Database.Database
  adbClient: AdbClient
  adbCommandLog: AdbCommandLog
  deviceRegistry: DeviceRegistry
  appMetadataService: AppMetadataService
  adbSettingsService: AdbSettingsService
  updateCheckService: UpdateCheckService
  logger: FileLogger
}

/**
 * Builds every long-lived service the app needs, wired together. Kept
 * separate from main/index.ts so that file can stay focused on Electron's
 * own app/window lifecycle rather than on constructing business logic.
 */
export function createAppContext(logger: FileLogger): AppContext {
  const userDataDir = app.getPath('userData')
  const db = openDatabase(join(userDataDir, 'droid-or.db'))
  const adbCommandLog = new AdbCommandLog((entry) => {
    const device = entry.deviceId ? ` [${entry.deviceId}]` : ''
    const outcome = entry.success ? 'ok' : `FAILED: ${entry.errorMessage ?? 'unknown error'}`
    const line = `adb${device} ${entry.command} (${entry.durationMs} ms) ${outcome}`
    if (entry.success) {
      logger.info(line)
    } else {
      logger.warn(line)
    }
  })
  const adbClient = new LoggingAdbClient(
    new RealAdbClient(resolveEffectiveAdbCommand(db, userDataDir)),
    adbCommandLog
  )
  const deviceRegistry = new DeviceRegistry(db, adbClient)
  const appMetadataService = new AppMetadataService(db, adbClient)
  const adbSettingsService = new AdbSettingsService(db, adbClient, deviceRegistry, userDataDir)

  const updateCheckService = new UpdateCheckService(db, getJson, app.getVersion())

  return {
    db,
    adbClient,
    adbCommandLog,
    deviceRegistry,
    appMetadataService,
    adbSettingsService,
    updateCheckService,
    logger
  }
}
