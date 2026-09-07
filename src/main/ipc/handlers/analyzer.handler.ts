import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import {
  analyzeDeviceRequestSchema,
  setPackageIgnoredRequestSchema
} from '@shared/validation/analyzer.schema'
import type Database from 'better-sqlite3'
import type { AdbClient } from '../../adb/adb-client'
import { analyzeDevice } from '../../android/analyzer.service'
import type { DeviceRegistry } from '../../android/device-registry'
import { setPackageIgnored } from '../../persistence/ignored-packages.repository'

export function registerAnalyzerHandlers(
  db: Database.Database,
  adbClient: AdbClient,
  registry: DeviceRegistry
): void {
  ipcMain.handle(IpcChannel.AnalyzeDevice, async (_event, payload: unknown) => {
    const { deviceId } = analyzeDeviceRequestSchema.parse(payload)

    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }

    return analyzeDevice(db, adbClient, deviceId)
  })

  ipcMain.handle(IpcChannel.SetPackageIgnored, (_event, payload: unknown) => {
    const { packageName, ignored } = setPackageIgnoredRequestSchema.parse(payload)
    setPackageIgnored(db, packageName, ignored)
  })
}
