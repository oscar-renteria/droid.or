import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { getSecurityReviewRequestSchema } from '@shared/validation/security-review.schema'
import type { AdbClient } from '../../adb/adb-client'
import type { DeviceRegistry } from '../../android/device-registry'
import { getSecurityReview } from '../../android/security-review.service'

export function registerSecurityReviewHandlers(
  adbClient: AdbClient,
  registry: DeviceRegistry
): void {
  ipcMain.handle(IpcChannel.GetSecurityReview, async (_event, payload: unknown) => {
    const { deviceId } = getSecurityReviewRequestSchema.parse(payload)

    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }

    return getSecurityReview(adbClient, deviceId)
  })
}
