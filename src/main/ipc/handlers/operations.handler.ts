import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import {
  getHistoryRequestSchema,
  performOperationRequestSchema
} from '@shared/validation/operation.schema'
import type Database from 'better-sqlite3'
import type { AdbClient } from '../../adb/adb-client'
import type { DeviceRegistry } from '../../android/device-registry'
import { performPackageOperation } from '../../android/package-operations.service'
import { getOperationHistory } from '../../persistence/operation-history.repository'

export function registerOperationsHandlers(
  db: Database.Database,
  adbClient: AdbClient,
  registry: DeviceRegistry
): void {
  // In-flight lock keyed by "deviceId:packageName" — prevents, e.g., a
  // double-click from firing two conflicting mutations at the same package
  // at once. Deliberately not persisted: it only needs to survive for the
  // lifetime of one operation, and the app's own process is the only thing
  // that could race against itself this way.
  const operationsInFlight = new Set<string>()

  ipcMain.handle(IpcChannel.PerformOperation, async (_event, payload: unknown) => {
    const { deviceId, packageName, operation } = performOperationRequestSchema.parse(payload)

    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }

    const lockKey = `${deviceId}:${packageName}`
    if (operationsInFlight.has(lockKey)) {
      throw new Error('Another operation is already in progress for this package.')
    }

    operationsInFlight.add(lockKey)
    try {
      return await performPackageOperation(db, adbClient, deviceId, packageName, operation)
    } finally {
      operationsInFlight.delete(lockKey)
    }
  })

  ipcMain.handle(IpcChannel.GetOperationHistory, (_event, payload: unknown) => {
    const { deviceId } = getHistoryRequestSchema.parse(payload)
    return getOperationHistory(db, deviceId)
  })
}
