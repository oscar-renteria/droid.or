import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { setCustomAdbPathRequestSchema } from '@shared/validation/adb-settings.schema'
import type { AdbSettingsService } from '../../adb/adb-settings.service'
import type { AdbClient } from '../../adb/adb-client'

export function registerAdbHandlers(
  adbClient: AdbClient,
  adbSettingsService: AdbSettingsService
): void {
  ipcMain.handle(IpcChannel.GetAdbAvailability, () => adbClient.getAvailability())

  ipcMain.handle(IpcChannel.GetAdbStatus, () => adbSettingsService.getStatus())

  ipcMain.handle(IpcChannel.SetCustomAdbPath, async (_event, payload: unknown) => {
    const { path } = setCustomAdbPathRequestSchema.parse(payload)
    return adbSettingsService.setCustomPath(path)
  })

  ipcMain.handle(IpcChannel.DownloadPlatformTools, () => adbSettingsService.downloadPlatformTools())

  ipcMain.handle(IpcChannel.BrowseForAdbExecutable, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      title: 'Select the adb executable'
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })
}
