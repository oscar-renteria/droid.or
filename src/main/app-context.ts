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

export interface AppContext {
  db: Database.Database
  adbClient: AdbClient
  adbCommandLog: AdbCommandLog
  deviceRegistry: DeviceRegistry
  appMetadataService: AppMetadataService
  adbSettingsService: AdbSettingsService
}

/**
 * Builds every long-lived service the app needs, wired together. Kept
 * separate from main/index.ts so that file can stay focused on Electron's
 * own app/window lifecycle rather than on constructing business logic.
 */
export function createAppContext(): AppContext {
  const userDataDir = app.getPath('userData')
  const db = openDatabase(join(userDataDir, 'droid-or.db'))
  const adbCommandLog = new AdbCommandLog()
  const adbClient = new LoggingAdbClient(
    new RealAdbClient(resolveEffectiveAdbCommand(db, userDataDir)),
    adbCommandLog
  )
  const deviceRegistry = new DeviceRegistry(db, adbClient)
  const appMetadataService = new AppMetadataService(db, adbClient)
  const adbSettingsService = new AdbSettingsService(db, adbClient, deviceRegistry, userDataDir)

  return { db, adbClient, adbCommandLog, deviceRegistry, appMetadataService, adbSettingsService }
}
