import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'

// This preload runs sandboxed (see main/index.ts), where `require` only
// resolves `electron` and a few polyfills — any `node:*` import makes the
// whole script fail to load and leaves the renderer without `window.droidor`.
// Use web platform APIs instead (e.g. `crypto.randomUUID()` below).
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
import { splitInstallAnalysisSchema } from '@shared/validation/split-install.schema'
import {
  deviceTransferPackageListSchema,
  deviceTransferProgressEventSchema,
  type DeviceTransferProgressEvent,
  type DeviceTransferProgressUpdate
} from '@shared/validation/device-transfer.schema'
import { z } from 'zod'
import { packageBackupResultSchema } from '@shared/validation/apk-backup.schema'
import { securityReviewResultSchema } from '@shared/validation/security-review.schema'
import { adbCommandLogListSchema } from '@shared/validation/logs.schema'
import { safetyDisclaimerStatusSchema } from '@shared/validation/safety-disclaimer.schema'
import { aiAnalysisResultSchema, aiSettingsSchema } from '@shared/validation/ai-settings.schema'
import { openDonationLinkResultSchema } from '@shared/validation/support.schema'
import { updateStatusSchema } from '@shared/validation/update.schema'
import type { DroidorApi } from '@shared/types/droidor-api'
import { stripIpcErrorPrefix } from '@shared/utils/ipc-error'

/** `ipcRenderer.invoke` with Electron's "Error invoking remote method …"
 *  prefix removed from rejections, so the renderer shows the handler's own
 *  message. */
function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke(channel, ...args).catch((error: unknown) => {
    throw error instanceof Error ? new Error(stripIpcErrorPrefix(error.message)) : error
  })
}

function toProgressUpdate(event: DeviceTransferProgressEvent): DeviceTransferProgressUpdate {
  switch (event.phase) {
    case 'pulling':
      return {
        phase: event.phase,
        fileName: event.fileName,
        fileNumber: event.fileNumber,
        totalFiles: event.totalFiles
      }
    case 'checking':
      return { phase: event.phase }
    case 'installing':
      return { phase: event.phase, fileCount: event.fileCount }
  }
}

function listenForTransferProgress(
  transferId: string,
  callback?: (progress: DeviceTransferProgressUpdate) => void
): () => void {
  if (!callback) {
    return () => {}
  }
  const listener = (_event: IpcRendererEvent, payload: unknown): void => {
    const progress = deviceTransferProgressEventSchema.parse(payload)
    if (progress.transferId === transferId) {
      callback(toProgressUpdate(progress))
    }
  }
  ipcRenderer.on(IpcEventChannel.DeviceTransferProgress, listener)
  return () => ipcRenderer.removeListener(IpcEventChannel.DeviceTransferProgress, listener)
}

/**
 * The only surface the renderer ever sees. Each function forwards to exactly
 * one IPC channel and validates the response shape before handing it to the
 * renderer, so a bug in the main-process handler can't leak malformed data
 * into untyped renderer code.
 */
const droidorApi: DroidorApi = {
  getAppInfo: async () => {
    const result = await invoke(IpcChannel.GetAppInfo)
    return appInfoSchema.parse(result)
  },

  openDonationLink: async (provider) => {
    const result = await invoke(IpcChannel.OpenDonationLink, provider)
    return openDonationLinkResultSchema.parse(result)
  },

  openThirdPartyNotices: async () => {
    await invoke(IpcChannel.OpenThirdPartyNotices)
  },

  getUpdateStatus: async () => {
    const result = await invoke(IpcChannel.GetUpdateStatus)
    return updateStatusSchema.parse(result)
  },

  setUpdateCheckEnabled: async (enabled) => {
    const result = await invoke(IpcChannel.SetUpdateCheckEnabled, enabled)
    return updateStatusSchema.parse(result)
  },

  openReleasePage: async () => {
    await invoke(IpcChannel.OpenReleasePage)
  },

  getAdbAvailability: async () => {
    const result = await invoke(IpcChannel.GetAdbAvailability)
    return adbAvailabilitySchema.parse(result)
  },

  getDevices: async () => {
    const result = await invoke(IpcChannel.GetDevices)
    return deviceListSchema.parse(result)
  },

  renameDevice: async (id, nickname) => {
    await invoke(IpcChannel.RenameDevice, { id, nickname })
  },

  removeDevice: async (id) => {
    await invoke(IpcChannel.RemoveDevice, { id })
  },

  clearDeviceHistory: async () => {
    await invoke(IpcChannel.ClearDeviceHistory)
  },

  onDevicesChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: unknown): void => {
      callback(deviceListSchema.parse(payload) as KnownDevice[])
    }
    ipcRenderer.on(IpcEventChannel.DevicesChanged, listener)
    return () => ipcRenderer.removeListener(IpcEventChannel.DevicesChanged, listener)
  },

  getDeviceDashboardInfo: async (id) => {
    const result = await invoke(IpcChannel.GetDeviceDashboardInfo, { id })
    return deviceDashboardInfoSchema.parse(result)
  },

  getPackages: async (deviceId) => {
    const result = await invoke(IpcChannel.GetPackages, { deviceId })
    return packageListSchema.parse(result)
  },

  getAppMetadata: async (request) => {
    const result = await invoke(IpcChannel.GetAppMetadata, request)
    return appMetadataResultSchema.parse(result)
  },

  analyzeDevice: async (deviceId) => {
    const result = await invoke(IpcChannel.AnalyzeDevice, { deviceId })
    return analyzeDeviceResultSchema.parse(result)
  },

  setPackageIgnored: async (packageName, ignored) => {
    await invoke(IpcChannel.SetPackageIgnored, { packageName, ignored })
  },

  setPackageFavorite: async (packageName, favorite) => {
    await invoke(IpcChannel.SetPackageFavorite, { packageName, favorite })
  },

  performOperation: async (deviceId, packageName, operation) => {
    const result = await invoke(IpcChannel.PerformOperation, {
      deviceId,
      packageName,
      operation
    })
    return operationResultSchema.parse(result)
  },

  getOperationHistory: async (deviceId) => {
    const result = await invoke(IpcChannel.GetOperationHistory, { deviceId })
    return operationHistoryListSchema.parse(result)
  },

  getDeviceChanges: async (deviceId) => {
    const result = await invoke(IpcChannel.GetDeviceChanges, { deviceId })
    return deviceChangesSchema.parse(result)
  },

  getAdbStatus: async () => {
    const result = await invoke(IpcChannel.GetAdbStatus)
    return adbStatusSchema.parse(result)
  },

  setCustomAdbPath: async (path) => {
    const result = await invoke(IpcChannel.SetCustomAdbPath, { path })
    return adbStatusSchema.parse(result)
  },

  downloadPlatformTools: async () => {
    const result = await invoke(IpcChannel.DownloadPlatformTools)
    return adbStatusSchema.parse(result)
  },

  browseForAdbExecutable: async () => {
    const result: unknown = await invoke(IpcChannel.BrowseForAdbExecutable)
    return typeof result === 'string' ? result : null
  },

  browseForApkFiles: async () => {
    const result: unknown = await invoke(IpcChannel.BrowseForApkFiles)
    return Array.isArray(result)
      ? result.filter((path): path is string => typeof path === 'string')
      : []
  },

  getPathForFile: (file) => webUtils.getPathForFile(file),

  inspectApkFile: async (deviceId, filePath) => {
    const result = await invoke(IpcChannel.InspectApkFile, { deviceId, filePath })
    return apkInspectionResultSchema.parse(result)
  },

  installApk: async (deviceId, filePath) => {
    const result = await invoke(IpcChannel.InstallApk, { deviceId, filePath })
    return operationResultSchema.parse(result)
  },

  browseForSplitArchiveFile: async () => {
    const result: unknown = await invoke(IpcChannel.BrowseForSplitArchiveFile)
    return typeof result === 'string' ? result : null
  },

  browseForSplitDirectory: async () => {
    const result: unknown = await invoke(IpcChannel.BrowseForSplitDirectory)
    return typeof result === 'string' ? result : null
  },

  analyzeSplitInstallSource: async (deviceId, sourceKind, sourcePaths) => {
    const result = await invoke(IpcChannel.AnalyzeSplitInstallSource, {
      deviceId,
      sourceKind,
      sourcePaths
    })
    return splitInstallAnalysisSchema.parse(result)
  },

  installSplitApks: async (deviceId, sourceKind, sourcePaths, selectedFileNames) => {
    const result = await invoke(IpcChannel.InstallSplitApks, {
      deviceId,
      sourceKind,
      sourcePaths,
      selectedFileNames
    })
    return operationResultSchema.parse(result)
  },

  browseForBackupDirectory: async () => {
    const result: unknown = await invoke(IpcChannel.BrowseForBackupDirectory)
    return typeof result === 'string' ? result : null
  },

  backupPackages: async (deviceId, packageNames, destDir) => {
    const result = await invoke(IpcChannel.BackupPackages, {
      deviceId,
      packageNames,
      destDir
    })
    return z.array(packageBackupResultSchema).parse(result)
  },

  analyzeDeviceTransfer: async (sourceDeviceId, targetDeviceId, packageName, onProgress) => {
    const transferId = crypto.randomUUID()
    const removeProgressListener = listenForTransferProgress(transferId, onProgress)
    try {
      const result = await invoke(IpcChannel.AnalyzeDeviceTransfer, {
        sourceDeviceId,
        targetDeviceId,
        packageName,
        transferId
      })
      return splitInstallAnalysisSchema.parse(result)
    } finally {
      removeProgressListener()
    }
  },

  performDeviceTransfer: async (
    sourceDeviceId,
    targetDeviceId,
    packageName,
    expectedVersionCode,
    onProgress
  ) => {
    const transferId = crypto.randomUUID()
    const removeProgressListener = listenForTransferProgress(transferId, onProgress)
    try {
      const result = await invoke(IpcChannel.PerformDeviceTransfer, {
        sourceDeviceId,
        targetDeviceId,
        packageName,
        expectedVersionCode,
        transferId
      })
      return operationResultSchema.parse(result)
    } finally {
      removeProgressListener()
    }
  },

  getDeviceTransferPackages: async (sourceDeviceId) => {
    const result = await invoke(IpcChannel.GetDeviceTransferPackages, {
      sourceDeviceId
    })
    return deviceTransferPackageListSchema.parse(result)
  },

  getSecurityReview: async (deviceId) => {
    const result = await invoke(IpcChannel.GetSecurityReview, { deviceId })
    return securityReviewResultSchema.parse(result)
  },

  getLogs: async () => {
    const result = await invoke(IpcChannel.GetLogs)
    return adbCommandLogListSchema.parse(result)
  },

  clearLogs: async () => {
    await invoke(IpcChannel.ClearLogs)
  },

  exportLogs: async () => {
    const result: unknown = await invoke(IpcChannel.ExportLogs)
    return typeof result === 'string' ? result : null
  },

  openLogsFolder: async () => {
    await invoke(IpcChannel.OpenLogsFolder)
  },

  logRendererError: async (report) => {
    await invoke(IpcChannel.LogRendererError, report)
  },

  getSafetyDisclaimerStatus: async () => {
    const result = await invoke(IpcChannel.GetSafetyDisclaimerStatus)
    return safetyDisclaimerStatusSchema.parse(result)
  },

  acknowledgeSafetyDisclaimer: async () => {
    const result = await invoke(IpcChannel.AcknowledgeSafetyDisclaimer)
    return safetyDisclaimerStatusSchema.parse(result)
  },

  getAiSettings: async () => {
    const result = await invoke(IpcChannel.GetAiSettings)
    return aiSettingsSchema.parse(result)
  },

  setAiSettings: async (update) => {
    const result = await invoke(IpcChannel.SetAiSettings, update)
    return aiSettingsSchema.parse(result)
  },

  analyzePackageWithAi: async (request) => {
    const result = await invoke(IpcChannel.AnalyzePackageWithAi, request)
    return aiAnalysisResultSchema.parse(result)
  }
}

contextBridge.exposeInMainWorld('droidor', droidorApi)
