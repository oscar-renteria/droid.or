import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { appInfoSchema } from '@shared/validation/app-info.schema'
import type { DroidorApi } from '@shared/types/droidor-api'

/**
 * The only surface the renderer ever sees. Each function forwards to exactly
 * one IPC channel and validates the response shape before handing it to the
 * renderer, so a bug in the main-process handler can't leak malformed data
 * into untyped renderer code.
 */
const droidorApi: DroidorApi = {
  getAppInfo: async () => {
    const result = await ipcRenderer.invoke(IpcChannel.GetAppInfo)
    return appInfoSchema.parse(result)
  }
}

contextBridge.exposeInMainWorld('droidor', droidorApi)
