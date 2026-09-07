import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import {
  appMetadataRequestSchema,
  packageListRequestSchema
} from '@shared/validation/package.schema'
import type { AdbClient } from '../../adb/adb-client'
import type { AppMetadataService } from '../../android/app-metadata.service'
import type { DeviceRegistry } from '../../android/device-registry'
import { fetchInstalledPackages } from '../../android/package.service'

function assertDeviceConnected(registry: DeviceRegistry, deviceId: string): void {
  const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
  if (!device || device.connectionState !== 'device') {
    throw new Error('This device is not currently connected and authorized.')
  }
}

export function registerPackagesHandlers(
  adbClient: AdbClient,
  registry: DeviceRegistry,
  appMetadataService: AppMetadataService
): void {
  ipcMain.handle(IpcChannel.GetPackages, async (_event, payload: unknown) => {
    const { deviceId } = packageListRequestSchema.parse(payload)
    assertDeviceConnected(registry, deviceId)
    return fetchInstalledPackages(adbClient, deviceId)
  })

  ipcMain.handle(IpcChannel.GetAppMetadata, async (_event, payload: unknown) => {
    const { deviceId, packageName, apkPath, versionCode } = appMetadataRequestSchema.parse(payload)
    assertDeviceConnected(registry, deviceId)
    return appMetadataService.getMetadata({ serial: deviceId, packageName, apkPath, versionCode })
  })
}
