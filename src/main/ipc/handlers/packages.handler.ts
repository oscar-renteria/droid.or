import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { packageListRequestSchema } from '@shared/validation/package.schema'
import type { AdbClient } from '../../adb/adb-client'
import type { DeviceRegistry } from '../../android/device-registry'
import { fetchInstalledPackages } from '../../android/package.service'

export function registerPackagesHandlers(adbClient: AdbClient, registry: DeviceRegistry): void {
  ipcMain.handle(IpcChannel.GetPackages, async (_event, payload: unknown) => {
    const { deviceId } = packageListRequestSchema.parse(payload)

    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }

    return fetchInstalledPackages(adbClient, deviceId)
  })
}
