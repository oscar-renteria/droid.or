/**
 * Every IPC channel the app uses. Renderer and preload must only ever
 * reference channels through this enum, never as raw string literals,
 * so a typo becomes a compile error instead of a silent no-op handler.
 */
export enum IpcChannel {
  GetAppInfo = 'app:get-info',
  GetAdbAvailability = 'adb:get-availability',
  GetDevices = 'device:get-all',
  RenameDevice = 'device:rename',
  RemoveDevice = 'device:remove',
  ClearDeviceHistory = 'device:clear-history',
  GetDeviceDashboardInfo = 'device:get-dashboard-info',
  GetPackages = 'packages:get-all',
  GetAppMetadata = 'packages:get-app-metadata',
  SetPackageIgnored = 'packages:set-ignored',
  AnalyzeDevice = 'analyzer:analyze-device',
  PerformOperation = 'packages:perform-operation',
  GetOperationHistory = 'history:get-for-device',
  GetDeviceChanges = 'recovery:get-device-changes'
}

/**
 * Push channels: the main process sends these unsolicited (webContents.send),
 * rather than in response to a renderer-initiated invoke() call.
 */
export enum IpcEventChannel {
  DevicesChanged = 'device:list-changed'
}
