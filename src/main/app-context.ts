import { app } from 'electron'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { RealAdbClient, type AdbClient } from './adb/adb-client'
import { AdbSettingsService, resolveEffectiveAdbCommand } from './adb/adb-settings.service'
import { AppMetadataService } from './android/app-metadata.service'
import { DeviceRegistry } from './android/device-registry'
import { openDatabase } from './persistence/database'

export interface AppContext {
  db: Database.Database
  adbClient: AdbClient
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
  const adbClient = new RealAdbClient(resolveEffectiveAdbCommand(db, userDataDir))
  const deviceRegistry = new DeviceRegistry(db, adbClient)
  const appMetadataService = new AppMetadataService(db, adbClient)
  const adbSettingsService = new AdbSettingsService(db, adbClient, deviceRegistry, userDataDir)

  return { db, adbClient, deviceRegistry, appMetadataService, adbSettingsService }
}
