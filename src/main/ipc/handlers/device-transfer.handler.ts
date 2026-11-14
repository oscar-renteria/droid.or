import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IpcChannel, IpcEventChannel } from '@shared/constants/ipc-channels'
import type { KnownDevice } from '@shared/validation/device.schema'
import type { DeviceTransferProgressUpdate } from '@shared/validation/device-transfer.schema'
import {
  getDeviceTransferPackagesRequestSchema,
  analyzeDeviceTransferRequestSchema,
  performDeviceTransferRequestSchema
} from '@shared/validation/device-transfer.schema'
import type Database from 'better-sqlite3'
import type { AdbClient } from '../../adb/adb-client'
import { isValidPackageName } from '../../adb/android-package-name'
import type { DeviceRegistry } from '../../android/device-registry'
import {
  analyzeDeviceTransfer,
  getDeviceTransferPackages,
  performDeviceTransfer
} from '../../android/device-transfer.service'

function describeDevice(device: KnownDevice): string {
  const name =
    device.nickname ?? ([device.manufacturer, device.model].filter(Boolean).join(' ') || null)
  return name ? `${name} (${device.id})` : device.id
}

export function registerDeviceTransferHandlers(
  db: Database.Database,
  adbClient: AdbClient,
  registry: DeviceRegistry
): void {
  // One lock for both steps: each pulls the whole app from the source, so
  // a double-click on either button shouldn't start two pulls at once.
  const transfersInFlight = new Set<string>()

  function requireConnectedDevice(deviceId: string, role: 'source' | 'target'): KnownDevice {
    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error(`The ${role} device is not currently connected and authorized.`)
    }
    return device
  }

  ipcMain.handle(IpcChannel.GetDeviceTransferPackages, async (_event, payload: unknown) => {
    const { sourceDeviceId } = getDeviceTransferPackagesRequestSchema.parse(payload)
    requireConnectedDevice(sourceDeviceId, 'source')
    return getDeviceTransferPackages(adbClient, sourceDeviceId)
  })

  async function withLock<T>(key: string, run: () => Promise<T>): Promise<T> {
    if (transfersInFlight.has(key)) {
      throw new Error('This app is already being copied to that device.')
    }
    transfersInFlight.add(key)
    try {
      return await run()
    } finally {
      transfersInFlight.delete(key)
    }
  }

  ipcMain.handle(IpcChannel.AnalyzeDeviceTransfer, async (event, payload: unknown) => {
    const { sourceDeviceId, targetDeviceId, packageName, transferId } =
      analyzeDeviceTransferRequestSchema.parse(payload)
    if (!isValidPackageName(packageName)) {
      throw new Error(`Refusing to copy an invalid package name: "${packageName}"`)
    }
    requireConnectedDevice(sourceDeviceId, 'source')
    requireConnectedDevice(targetDeviceId, 'target')

    return withLock(`${sourceDeviceId}:${targetDeviceId}:${packageName}`, () =>
      analyzeDeviceTransfer(
        adbClient,
        sourceDeviceId,
        targetDeviceId,
        packageName,
        undefined,
        (progress) => sendProgress(event, transferId, progress)
      )
    )
  })

  ipcMain.handle(IpcChannel.PerformDeviceTransfer, async (event, payload: unknown) => {
    const { sourceDeviceId, targetDeviceId, packageName, expectedVersionCode, transferId } =
      performDeviceTransferRequestSchema.parse(payload)
    if (!isValidPackageName(packageName)) {
      throw new Error(`Refusing to copy an invalid package name: "${packageName}"`)
    }
    const source = requireConnectedDevice(sourceDeviceId, 'source')
    requireConnectedDevice(targetDeviceId, 'target')

    return withLock(`${sourceDeviceId}:${targetDeviceId}:${packageName}`, () =>
      performDeviceTransfer(
        db,
        adbClient,
        sourceDeviceId,
        targetDeviceId,
        packageName,
        expectedVersionCode,
        `Copied from ${describeDevice(source)}.`,
        undefined,
        (progress) => sendProgress(event, transferId, progress)
      )
    )
  })

  function sendProgress(
    event: IpcMainInvokeEvent,
    transferId: string,
    progress: DeviceTransferProgressUpdate
  ): void {
    if (!event.sender.isDestroyed()) {
      event.sender.send(IpcEventChannel.DeviceTransferProgress, { transferId, ...progress })
    }
  }
}
