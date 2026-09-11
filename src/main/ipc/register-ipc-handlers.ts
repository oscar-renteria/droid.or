import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel, IpcEventChannel } from '@shared/constants/ipc-channels'
import type { AppContext } from '../app-context'
import { getAppInfo } from './handlers/app-info.handler'
import { registerAdbHandlers } from './handlers/adb.handler'
import { registerAiHandlers } from './handlers/ai.handler'
import { registerApkBackupHandlers } from './handlers/apk-backup.handler'
import { registerApkInstallHandlers } from './handlers/apk-install.handler'
import { registerAnalyzerHandlers } from './handlers/analyzer.handler'
import { registerDashboardHandlers } from './handlers/dashboard.handler'
import { registerDeviceHandlers } from './handlers/device.handler'
import { registerLogsHandlers } from './handlers/logs.handler'
import { registerOperationsHandlers } from './handlers/operations.handler'
import { registerPackagesHandlers } from './handlers/packages.handler'
import { registerRecoveryHandlers } from './handlers/recovery.handler'
import { registerSafetyDisclaimerHandlers } from './handlers/safety-disclaimer.handler'
import { registerSecurityReviewHandlers } from './handlers/security-review.handler'
import { registerSplitInstallHandlers } from './handlers/split-install.handler'

/**
 * Wires every supported IPC channel to its handler. This is the only place
 * that calls ipcMain.handle, so the full set of channels the renderer can
 * ever reach is visible in one file.
 */
export function registerIpcHandlers(context: AppContext): void {
  ipcMain.handle(IpcChannel.GetAppInfo, () => getAppInfo())

  registerAdbHandlers(context.adbClient, context.adbSettingsService)
  registerDeviceHandlers(context.deviceRegistry)
  registerDashboardHandlers(context.adbClient, context.deviceRegistry)
  registerPackagesHandlers(
    context.db,
    context.adbClient,
    context.deviceRegistry,
    context.appMetadataService
  )
  registerAnalyzerHandlers(context.db, context.adbClient, context.deviceRegistry)
  registerOperationsHandlers(context.db, context.adbClient, context.deviceRegistry)
  registerRecoveryHandlers(context.db, context.adbClient, context.deviceRegistry)
  registerApkInstallHandlers(context.db, context.adbClient, context.deviceRegistry)
  registerSplitInstallHandlers(context.db, context.adbClient, context.deviceRegistry)
  registerApkBackupHandlers(context.adbClient, context.deviceRegistry)
  registerSecurityReviewHandlers(context.adbClient, context.deviceRegistry)
  registerLogsHandlers(context.adbCommandLog)
  registerSafetyDisclaimerHandlers(context.db)
  registerAiHandlers(context.db, context.adbClient, context.deviceRegistry)

  context.deviceRegistry.onDevicesChanged((devices) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcEventChannel.DevicesChanged, devices)
    }
  })
}
