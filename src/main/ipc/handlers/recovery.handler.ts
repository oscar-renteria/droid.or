import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { getDeviceChangesRequestSchema } from '@shared/validation/recovery.schema'
import type Database from 'better-sqlite3'
import type { AdbClient } from '../../adb/adb-client'
import type { DeviceRegistry } from '../../android/device-registry'
import { getDeviceChanges } from '../../android/recovery.service'

export function registerRecoveryHandlers(
  db: Database.Database,
  adbClient: AdbClient,
  registry: DeviceRegistry
): void {
  ipcMain.handle(IpcChannel.GetDeviceChanges, async (_event, payload: unknown) => {
    const { deviceId } = getDeviceChangesRequestSchema.parse(payload)

    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }

    return getDeviceChanges(db, adbClient, deviceId)
  })
}
