import type { AppInfo } from './app-info'
import type { AdbAvailability, KnownDevice } from './device'
import type { DeviceDashboardInfo } from './device-dashboard'

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
}
