import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { deviceIdRequestSchema, renameDeviceRequestSchema } from '@shared/validation/device.schema'
import type { DeviceRegistry } from '../../android/device-registry'

export function registerDeviceHandlers(registry: DeviceRegistry): void {
  ipcMain.handle(IpcChannel.GetDevices, () => registry.getCurrentDevices())

  ipcMain.handle(IpcChannel.RenameDevice, (_event, payload: unknown) => {
    const { id, nickname } = renameDeviceRequestSchema.parse(payload)
    registry.renameDevice(id, nickname)
  })

  ipcMain.handle(IpcChannel.RemoveDevice, (_event, payload: unknown) => {
    const { id } = deviceIdRequestSchema.parse(payload)
    registry.removeDevice(id)
  })

  ipcMain.handle(IpcChannel.ClearDeviceHistory, () => {
    registry.clearHistory()
  })
}
