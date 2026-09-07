import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel, IpcEventChannel } from '@shared/constants/ipc-channels'
import { appInfoSchema } from '@shared/validation/app-info.schema'
import {
  adbAvailabilitySchema,
  deviceListSchema,
  type KnownDevice
} from '@shared/validation/device.schema'
import { deviceDashboardInfoSchema } from '@shared/validation/device-dashboard.schema'
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
  },

  getAdbAvailability: async () => {
    const result = await ipcRenderer.invoke(IpcChannel.GetAdbAvailability)
    return adbAvailabilitySchema.parse(result)
  },

  getDevices: async () => {
    const result = await ipcRenderer.invoke(IpcChannel.GetDevices)
    return deviceListSchema.parse(result)
  },

  renameDevice: async (id, nickname) => {
    await ipcRenderer.invoke(IpcChannel.RenameDevice, { id, nickname })
  },

  removeDevice: async (id) => {
    await ipcRenderer.invoke(IpcChannel.RemoveDevice, { id })
  },

  clearDeviceHistory: async () => {
    await ipcRenderer.invoke(IpcChannel.ClearDeviceHistory)
  },

  onDevicesChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: unknown): void => {
      callback(deviceListSchema.parse(payload) as KnownDevice[])
    }
    ipcRenderer.on(IpcEventChannel.DevicesChanged, listener)
    return () => ipcRenderer.removeListener(IpcEventChannel.DevicesChanged, listener)
  },

  getDeviceDashboardInfo: async (id) => {
    const result = await ipcRenderer.invoke(IpcChannel.GetDeviceDashboardInfo, { id })
    return deviceDashboardInfoSchema.parse(result)
  }
}

contextBridge.exposeInMainWorld('droidor', droidorApi)
