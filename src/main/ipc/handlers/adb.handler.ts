import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import type { AdbClient } from '../../adb/adb-client'

export function registerAdbHandlers(adbClient: AdbClient): void {
  ipcMain.handle(IpcChannel.GetAdbAvailability, () => adbClient.getAvailability())
}
