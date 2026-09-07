import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { dashboardInfoRequestSchema } from '@shared/validation/device-dashboard.schema'
import type { AdbClient } from '../../adb/adb-client'
import type { DeviceRegistry } from '../../android/device-registry'
import { fetchDeviceDashboardInfo } from '../../android/device-dashboard.service'

export function registerDashboardHandlers(adbClient: AdbClient, registry: DeviceRegistry): void {
  ipcMain.handle(IpcChannel.GetDeviceDashboardInfo, async (_event, payload: unknown) => {
    const { id } = dashboardInfoRequestSchema.parse(payload)

    // Refuses rather than attempting and letting every shell call time out:
    // a device that isn't currently authorized and connected can't answer
    // any of these queries, and "not connected" is a clearer message than
    // a pile of individually-timed-out fields.
    const device = registry.getCurrentDevices().find((candidate) => candidate.id === id)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }

    return fetchDeviceDashboardInfo(adbClient, id)
  })
}
