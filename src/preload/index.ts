import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IpcChannel, IpcEventChannel } from '@shared/constants/ipc-channels'
import { appInfoSchema } from '@shared/validation/app-info.schema'
import {
  adbAvailabilitySchema,
  deviceListSchema,
  type KnownDevice
} from '@shared/validation/device.schema'
import { analyzeDeviceResultSchema } from '@shared/validation/analyzer.schema'
import { deviceDashboardInfoSchema } from '@shared/validation/device-dashboard.schema'
import { appMetadataResultSchema, packageListSchema } from '@shared/validation/package.schema'
import {
  operationHistoryListSchema,
  operationResultSchema
} from '@shared/validation/operation.schema'
import { deviceChangesSchema } from '@shared/validation/recovery.schema'
import { adbStatusSchema } from '@shared/validation/adb-settings.schema'
import { apkInspectionResultSchema } from '@shared/validation/apk-install.schema'
import { z } from 'zod'
import { packageBackupResultSchema } from '@shared/validation/apk-backup.schema'
import { securityReviewResultSchema } from '@shared/validation/security-review.schema'
import { adbCommandLogListSchema } from '@shared/validation/logs.schema'
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
  },

  getPackages: async (deviceId) => {
    const result = await ipcRenderer.invoke(IpcChannel.GetPackages, { deviceId })
    return packageListSchema.parse(result)
  },

  getAppMetadata: async (request) => {
    const result = await ipcRenderer.invoke(IpcChannel.GetAppMetadata, request)
    return appMetadataResultSchema.parse(result)
  },

  analyzeDevice: async (deviceId) => {
    const result = await ipcRenderer.invoke(IpcChannel.AnalyzeDevice, { deviceId })
    return analyzeDeviceResultSchema.parse(result)
  },

  setPackageIgnored: async (packageName, ignored) => {
    await ipcRenderer.invoke(IpcChannel.SetPackageIgnored, { packageName, ignored })
  },

  performOperation: async (deviceId, packageName, operation) => {
    const result = await ipcRenderer.invoke(IpcChannel.PerformOperation, {
      deviceId,
      packageName,
      operation
    })
    return operationResultSchema.parse(result)
  },

  getOperationHistory: async (deviceId) => {
    const result = await ipcRenderer.invoke(IpcChannel.GetOperationHistory, { deviceId })
    return operationHistoryListSchema.parse(result)
  },

  getDeviceChanges: async (deviceId) => {
    const result = await ipcRenderer.invoke(IpcChannel.GetDeviceChanges, { deviceId })
    return deviceChangesSchema.parse(result)
  },

  getAdbStatus: async () => {
    const result = await ipcRenderer.invoke(IpcChannel.GetAdbStatus)
    return adbStatusSchema.parse(result)
  },

  setCustomAdbPath: async (path) => {
    const result = await ipcRenderer.invoke(IpcChannel.SetCustomAdbPath, { path })
    return adbStatusSchema.parse(result)
  },

  downloadPlatformTools: async () => {
    const result = await ipcRenderer.invoke(IpcChannel.DownloadPlatformTools)
    return adbStatusSchema.parse(result)
  },

  browseForAdbExecutable: async () => {
    const result: unknown = await ipcRenderer.invoke(IpcChannel.BrowseForAdbExecutable)
    return typeof result === 'string' ? result : null
  },

  browseForApkFiles: async () => {
    const result: unknown = await ipcRenderer.invoke(IpcChannel.BrowseForApkFiles)
    return Array.isArray(result)
      ? result.filter((path): path is string => typeof path === 'string')
      : []
  },

  getPathForFile: (file) => webUtils.getPathForFile(file),

  inspectApkFile: async (deviceId, filePath) => {
    const result = await ipcRenderer.invoke(IpcChannel.InspectApkFile, { deviceId, filePath })
    return apkInspectionResultSchema.parse(result)
  },

  installApk: async (deviceId, filePath) => {
    const result = await ipcRenderer.invoke(IpcChannel.InstallApk, { deviceId, filePath })
    return operationResultSchema.parse(result)
  },

  browseForBackupDirectory: async () => {
    const result: unknown = await ipcRenderer.invoke(IpcChannel.BrowseForBackupDirectory)
    return typeof result === 'string' ? result : null
  },

  backupPackages: async (deviceId, packageNames, destDir) => {
    const result = await ipcRenderer.invoke(IpcChannel.BackupPackages, {
      deviceId,
      packageNames,
      destDir
    })
    return z.array(packageBackupResultSchema).parse(result)
  },

  getSecurityReview: async (deviceId) => {
    const result = await ipcRenderer.invoke(IpcChannel.GetSecurityReview, { deviceId })
    return securityReviewResultSchema.parse(result)
  },

  getLogs: async () => {
    const result = await ipcRenderer.invoke(IpcChannel.GetLogs)
    return adbCommandLogListSchema.parse(result)
  },

  clearLogs: async () => {
    await ipcRenderer.invoke(IpcChannel.ClearLogs)
  },

  exportLogs: async () => {
    const result: unknown = await ipcRenderer.invoke(IpcChannel.ExportLogs)
    return typeof result === 'string' ? result : null
  }
}

contextBridge.exposeInMainWorld('droidor', droidorApi)
