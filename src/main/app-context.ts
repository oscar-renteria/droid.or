import { app } from 'electron'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { RealAdbClient, type AdbClient } from './adb/adb-client'
import { resolveAdbCommand } from './adb/adb-path'
import { AppMetadataService } from './android/app-metadata.service'
import { DeviceRegistry } from './android/device-registry'
import { openDatabase } from './persistence/database'

export interface AppContext {
  db: Database.Database
  adbClient: AdbClient
  deviceRegistry: DeviceRegistry
  appMetadataService: AppMetadataService
}

/**
 * Builds every long-lived service the app needs, wired together. Kept
 * separate from main/index.ts so that file can stay focused on Electron's
 * own app/window lifecycle rather than on constructing business logic.
 */
export function createAppContext(): AppContext {
  const db = openDatabase(join(app.getPath('userData'), 'droid-or.db'))
  const adbClient = new RealAdbClient(resolveAdbCommand())
  const deviceRegistry = new DeviceRegistry(db, adbClient)
  const appMetadataService = new AppMetadataService(db, adbClient)

  return { db, adbClient, deviceRegistry, appMetadataService }
}
