import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { backupPackagesRequestSchema } from '@shared/validation/apk-backup.schema'
import type { AdbClient } from '../../adb/adb-client'
import { backupPackages } from '../../android/apk-backup.service'
import type { DeviceRegistry } from '../../android/device-registry'

export function registerApkBackupHandlers(adbClient: AdbClient, registry: DeviceRegistry): void {
  ipcMain.handle(IpcChannel.BrowseForBackupDirectory, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose a backup destination'
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannel.BackupPackages, async (_event, payload: unknown) => {
    const { deviceId, packageNames, destDir } = backupPackagesRequestSchema.parse(payload)

    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }

    return backupPackages(adbClient, deviceId, packageNames, destDir)
  })
}
