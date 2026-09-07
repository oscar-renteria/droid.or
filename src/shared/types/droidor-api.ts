import type { AnalyzeDeviceResult } from './analyzer'
import type { AdbStatus } from './adb-settings'
import type { AppInfo } from './app-info'
import type { AdbAvailability, KnownDevice } from './device'
import type { DeviceDashboardInfo } from './device-dashboard'
import type { AppMetadataResult, AppPackageInfo } from './package'
import type { MutatingOperationType, OperationHistoryEntry, OperationResult } from './operation'
import type { DeviceChanges } from './recovery'
import type { ApkInspectionResult } from './apk-install'

/**
 * Contract for the API the preload script exposes on window.droidor.
 * Defined here (not derived from the preload implementation) so the
 * renderer depends only on this shared contract, never on preload internals.
 */
export interface DroidorApi {
  getAppInfo: () => Promise<AppInfo>
  getAdbAvailability: () => Promise<AdbAvailability>
  /** Full picture of where the effective adb command came from and what
   *  else is available (a managed download, a configured custom path). */
  getAdbStatus: () => Promise<AdbStatus>
  /** Validates the path before persisting it — rejects if it doesn't look
   *  like a working adb executable. Pass null to clear a previous
   *  override. Takes effect immediately, including for any already-open
   *  device watch. */
  setCustomAdbPath: (path: string | null) => Promise<AdbStatus>
  /** Downloads the official platform-tools package for this OS/arch
   *  directly from Google's own distribution server, verifies it, and (if
   *  no custom path is set) switches to it immediately. Rejects if this
   *  platform/architecture has no managed build available. */
  downloadPlatformTools: () => Promise<AdbStatus>
  /** Opens a native file picker for choosing an adb executable. Resolves
   *  to null if the user cancels. */
  browseForAdbExecutable: () => Promise<string | null>
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
    operation: MutatingOperationType
  ) => Promise<OperationResult>
  getOperationHistory: (deviceId: string) => Promise<OperationHistoryEntry[]>
  /** Rejects if the device isn't currently connected and authorized. What
   *  this app has changed on the device and is still in effect, re-verified
   *  against its live state — not just what history recorded. */
  getDeviceChanges: (deviceId: string) => Promise<DeviceChanges>
  /** Opens a native multi-file picker filtered to .apk files. Resolves to
   *  an empty array if the user cancels. */
  browseForApkFiles: () => Promise<string[]>
  /** Resolves the real filesystem path for a File the user dropped onto
   *  the window — Electron-specific; a plain web File object never
   *  exposes this on its own. */
  getPathForFile: (file: File) => string
  /** Parses a local .apk file and compares it against what's (or isn't)
   *  already on the device. Rejects if the file can't be read as an APK,
   *  or if the device isn't currently connected and authorized. */
  inspectApkFile: (deviceId: string, filePath: string) => Promise<ApkInspectionResult>
  /** Installs (or updates/reinstalls) a local .apk file. Re-inspects the
   *  file itself rather than trusting a previously-returned inspection, so
   *  a file that changed on disk between inspecting and confirming can't
   *  install something other than what was shown. Rejects if the device
   *  isn't currently connected and authorized, or if this exact file is
   *  already being installed. */
  installApk: (deviceId: string, filePath: string) => Promise<OperationResult>
}
