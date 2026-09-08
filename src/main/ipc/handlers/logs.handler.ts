import { BrowserWindow, dialog, ipcMain, type SaveDialogOptions } from 'electron'
import { writeFile } from 'node:fs/promises'
import { IpcChannel } from '@shared/constants/ipc-channels'
import type { AdbCommandLog } from '../../adb/adb-command-log'

export function registerLogsHandlers(log: AdbCommandLog): void {
  ipcMain.handle(IpcChannel.GetLogs, () => log.getAll())

  ipcMain.handle(IpcChannel.ClearLogs, () => {
    log.clear()
  })

  ipcMain.handle(IpcChannel.ExportLogs, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: SaveDialogOptions = {
      title: 'Export Logs',
      defaultPath: `droidor-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) {
      return null
    }
    await writeFile(result.filePath, JSON.stringify(log.getAll(), null, 2), 'utf-8')
    return result.filePath
  })
}
