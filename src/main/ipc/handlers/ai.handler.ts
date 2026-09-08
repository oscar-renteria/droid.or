import { ipcMain } from 'electron'
import type Database from 'better-sqlite3'
import { IpcChannel } from '@shared/constants/ipc-channels'
import {
  analyzePackageWithAiRequestSchema,
  setAiSettingsRequestSchema
} from '@shared/validation/ai-settings.schema'
import type { AdbClient } from '../../adb/adb-client'
import { analyzePackageWithAi } from '../../android/ai-analysis.service'
import type { DeviceRegistry } from '../../android/device-registry'
import { getAiSettings, setAiSettings } from '../../persistence/ai-settings.repository'

export function registerAiHandlers(
  db: Database.Database,
  adbClient: AdbClient,
  registry: DeviceRegistry
): void {
  ipcMain.handle(IpcChannel.GetAiSettings, () => getAiSettings(db))

  ipcMain.handle(IpcChannel.SetAiSettings, (_event, payload: unknown) => {
    const update = setAiSettingsRequestSchema.parse(payload)
    setAiSettings(db, update)
    return getAiSettings(db)
  })

  ipcMain.handle(IpcChannel.AnalyzePackageWithAi, async (_event, payload: unknown) => {
    const request = analyzePackageWithAiRequestSchema.parse(payload)
    const device = registry
      .getCurrentDevices()
      .find((candidate) => candidate.id === request.deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }
    return analyzePackageWithAi(db, adbClient, device, request)
  })
}
