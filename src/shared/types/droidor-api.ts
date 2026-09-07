import type { AnalyzeDeviceResult } from './analyzer'
import type { AppInfo } from './app-info'
import type { AdbAvailability, KnownDevice } from './device'
import type { DeviceDashboardInfo } from './device-dashboard'
import type { AppMetadataResult, AppPackageInfo } from './package'
import type { OperationHistoryEntry, OperationResult, OperationType } from './operation'
import type { DeviceChanges } from './recovery'

/**
 * Contract for the API the preload script exposes on window.droidor.
 * Defined here (not derived from the preload implementation) so the
 * renderer depends only on this shared contract, never on preload internals.
 */
export interface DroidorApi {
  getAppInfo: () => Promise<AppInfo>
  getAdbAvailability: () => Promise<AdbAvailability>
  getDevices: () => Promise<KnownDevice[]>
  renameDevice: (id: string, nickname: string | null) => Promise<void>
  removeDevice: (id: string) => Promise<void>
  clearDeviceHistory: () => Promise<void>
  /** Subscribes to live device-list updates pushed from main. Returns an
   *  unsubscribe function. */
  onDevicesChanged: (callback: (devices: KnownDevice[]) => void) => () => void
  /** Rejects if the device isn't currently connected and authorized. */
  getDeviceDashboardInfo: (id: string) => Promise<DeviceDashboardInfo>
  /** Rejects if the device isn't currently connected and authorized. */
  getPackages: (deviceId: string) => Promise<AppPackageInfo[]>
  /** Resolves an app's real label/icon by pulling and parsing its APK.
   *  Slow relative to the other calls (a real device transfer) and result
   *  is cached in main by (package, version) — never call this for every
   *  package at once from the renderer; the store queues these itself. */
  getAppMetadata: (request: {
    deviceId: string
    packageName: string
    apkPath: string
    versionCode: number | null
  }) => Promise<AppMetadataResult>
  /** Rejects if the device isn't currently connected and authorized. */
  analyzeDevice: (deviceId: string) => Promise<AnalyzeDeviceResult>
  setPackageIgnored: (packageName: string, ignored: boolean) => Promise<void>
  /** Rejects if the device isn't currently connected and authorized, or if
   *  another operation is already in progress for this exact package. */
  performOperation: (
    deviceId: string,
    packageName: string,
    operation: OperationType
  ) => Promise<OperationResult>
  getOperationHistory: (deviceId: string) => Promise<OperationHistoryEntry[]>
  /** Rejects if the device isn't currently connected and authorized. What
   *  this app has changed on the device and is still in effect, re-verified
   *  against its live state — not just what history recorded. */
  getDeviceChanges: (deviceId: string) => Promise<DeviceChanges>
}
