import type Database from 'better-sqlite3'
import type { AdbSource, AdbStatus } from '@shared/validation/adb-settings.schema'
import type { DeviceRegistry } from '../android/device-registry'
import { getSetting, setSetting } from '../persistence/settings.repository'
import type { AdbClient } from './adb-client'
import { verifyAdb } from './adb-path'
import {
  downloadAndInstallPlatformTools,
  getManagedAdbPath,
  getPlatformToolsTarget,
  isManagedAdbInstalled
} from './platform-tools-manager'

const CUSTOM_PATH_SETTING_KEY = 'adb_custom_path'

/** Priority order: a validated custom path, then a completed managed
 *  download, then whatever "adb" resolves to on the system PATH. Pure and
 *  synchronous (no network, no process spawn) — exported standalone so
 *  app-context.ts can compute the *initial* adb command before the
 *  AdbClient (and so this service) even exist yet. */
export function resolveEffectiveAdbCommand(db: Database.Database, userDataDir: string): string {
  const customPath = getSetting(db, CUSTOM_PATH_SETTING_KEY)
  if (customPath) {
    return customPath
  }
  const target = getPlatformToolsTarget(process.platform, process.arch)
  if (target && isManagedAdbInstalled(userDataDir, target)) {
    return getManagedAdbPath(userDataDir, target)
  }
  return 'adb'
}

/**
 * Owns the "which adb executable does this app actually use" decision and
 * everything that can change it: a user-configured custom path, or a
 * managed platform-tools download this app installed itself. Whichever one
 * takes effect is pushed onto the live AdbClient immediately, and the
 * persistent device-list watch is restarted so it picks up the new binary
 * too — a plain shell command already reads the client's command fresh on
 * every call, but `track-devices` was spawned once and keeps running the
 * binary it started with until restarted.
 */
export class AdbSettingsService {
  constructor(
    private readonly db: Database.Database,
    private readonly adbClient: AdbClient,
    private readonly deviceRegistry: DeviceRegistry,
    private readonly userDataDir: string
  ) {}

  async getStatus(): Promise<AdbStatus> {
    const customPath = getSetting(this.db, CUSTOM_PATH_SETTING_KEY)
    const target = getPlatformToolsTarget(process.platform, process.arch)
    const managedInstalled = target !== null && isManagedAdbInstalled(this.userDataDir, target)

    const source: AdbSource = customPath ? 'custom' : managedInstalled ? 'managed' : 'system'

    return {
      availability: await this.adbClient.getAvailability(),
      source,
      resolvedPath: resolveEffectiveAdbCommand(this.db, this.userDataDir),
      customPath,
      managedInstalled,
      managedSupported: target !== null
    }
  }

  /** Validates the given path actually runs before persisting it, so a
   *  broken path never silently becomes the app's only ADB. Passing null
   *  clears the override, falling back to managed/system resolution. */
  async setCustomPath(path: string | null): Promise<AdbStatus> {
    if (path !== null) {
      const availability = await verifyAdb(path)
      if (!availability.available) {
        throw new Error(
          `This path doesn't look like a working adb executable: ${availability.reason}`
        )
      }
    }
    setSetting(this.db, CUSTOM_PATH_SETTING_KEY, path)
    this.applyEffectiveCommand()
    return this.getStatus()
  }

  async downloadPlatformTools(): Promise<AdbStatus> {
    const target = getPlatformToolsTarget(process.platform, process.arch)
    if (!target) {
      throw new Error(
        'Managed platform-tools download is not available for this operating system/architecture. Install Android platform-tools manually and set a custom path instead.'
      )
    }
    await downloadAndInstallPlatformTools(this.userDataDir, target)
    this.applyEffectiveCommand()
    return this.getStatus()
  }

  private applyEffectiveCommand(): void {
    this.adbClient.setAdbCommand(resolveEffectiveAdbCommand(this.db, this.userDataDir))
    this.deviceRegistry.stop()
    this.deviceRegistry.start()
  }
}
