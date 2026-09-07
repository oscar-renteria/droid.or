import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import {
  inspectApkRequestSchema,
  installApkRequestSchema
} from '@shared/validation/apk-install.schema'
import type Database from 'better-sqlite3'
import type { AdbClient } from '../../adb/adb-client'
import { getInstallPlan, installLocalApk } from '../../android/apk-install.service'
import type { DeviceRegistry } from '../../android/device-registry'
import { inspectLocalApk } from '../../android/local-apk-inspector'

export function registerApkInstallHandlers(
  db: Database.Database,
  adbClient: AdbClient,
  registry: DeviceRegistry
): void {
  // Same purpose as the lock in operations.handler.ts: a double-click (or
  // a queue processed too eagerly) shouldn't fire two installs of the same
  // package at the same device at once.
  const installsInFlight = new Set<string>()

  function requireConnectedDevice(deviceId: string): void {
    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }
  }

  ipcMain.handle(IpcChannel.BrowseForApkFiles, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Android Package', extensions: ['apk'] }],
      title: 'Select APK file(s) to install'
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled) {
      return []
    }
    return result.filePaths
  })

  ipcMain.handle(IpcChannel.InspectApkFile, async (_event, payload: unknown) => {
    const { deviceId, filePath } = inspectApkRequestSchema.parse(payload)
    requireConnectedDevice(deviceId)

    const info = await inspectLocalApk(filePath)
    const plan = await getInstallPlan(adbClient, deviceId, info)
    return { info, plan }
  })

  ipcMain.handle(IpcChannel.InstallApk, async (_event, payload: unknown) => {
    const { deviceId, filePath } = installApkRequestSchema.parse(payload)
    requireConnectedDevice(deviceId)

    const lockKey = `${deviceId}:${filePath}`
    if (installsInFlight.has(lockKey)) {
      throw new Error('This file is already being installed.')
    }

    installsInFlight.add(lockKey)
    try {
      const info = await inspectLocalApk(filePath)
      return await installLocalApk(db, adbClient, deviceId, info)
    } finally {
      installsInFlight.delete(lockKey)
    }
  })
}
