import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { IpcChannel } from '@shared/constants/ipc-channels'
import {
  analyzeSplitSourceRequestSchema,
  installSplitApksRequestSchema
} from '@shared/validation/split-install.schema'
import type Database from 'better-sqlite3'
import type { AdbClient } from '../../adb/adb-client'
import type { DeviceRegistry } from '../../android/device-registry'
import { buildSplitInstallAnalysis, performSplitInstall } from '../../android/split-install.service'

export function registerSplitInstallHandlers(
  db: Database.Database,
  adbClient: AdbClient,
  registry: DeviceRegistry
): void {
  // Same purpose as the equivalent lock in apk-install.handler.ts: a
  // double-click on Confirm shouldn't fire two install-multiple runs for
  // the same source at once.
  const installsInFlight = new Set<string>()

  function requireConnectedDevice(deviceId: string): void {
    const device = registry.getCurrentDevices().find((candidate) => candidate.id === deviceId)
    if (!device || device.connectionState !== 'device') {
      throw new Error('This device is not currently connected and authorized.')
    }
  }

  ipcMain.handle(IpcChannel.BrowseForSplitArchiveFile, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{ name: 'Split APK / App Bundle', extensions: ['apks', 'xapk', 'apkm'] }],
      title: 'Select a split APK / app bundle archive'
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannel.BrowseForSplitDirectory, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options: OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Select a folder containing split APK files'
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  ipcMain.handle(IpcChannel.AnalyzeSplitInstallSource, async (_event, payload: unknown) => {
    const { deviceId, sourceKind, sourcePaths } = analyzeSplitSourceRequestSchema.parse(payload)
    requireConnectedDevice(deviceId)

    return buildSplitInstallAnalysis(adbClient, deviceId, sourceKind, sourcePaths)
  })

  ipcMain.handle(IpcChannel.InstallSplitApks, async (_event, payload: unknown) => {
    const { deviceId, sourceKind, sourcePaths, selectedFileNames } =
      installSplitApksRequestSchema.parse(payload)
    requireConnectedDevice(deviceId)

    const lockKey = `${deviceId}:${sourceKind}:${sourcePaths.join('|')}`
    if (installsInFlight.has(lockKey)) {
      throw new Error('This source is already being installed.')
    }

    installsInFlight.add(lockKey)
    try {
      return await performSplitInstall(
        db,
        adbClient,
        deviceId,
        sourceKind,
        sourcePaths,
        selectedFileNames
      )
    } finally {
      installsInFlight.delete(lockKey)
    }
  })
}
