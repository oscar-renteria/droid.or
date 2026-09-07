import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { getAppInfo } from './handlers/app-info.handler'

/**
 * Wires every supported IPC channel to its handler. This is the only place
 * that calls ipcMain.handle, so the full set of channels the renderer can
 * ever reach is visible in one file.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.GetAppInfo, () => getAppInfo())
}
