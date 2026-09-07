import { app } from 'electron'
import process from 'node:process'
import type { AppInfo } from '@shared/types/app-info'
import { appInfoSchema } from '@shared/validation/app-info.schema'

/**
 * Builds the response for IpcChannel.GetAppInfo and validates it against the
 * shared schema before it ever reaches IPC, so a future change to this
 * function that drifts from the contract fails fast in development rather
 * than surfacing as a silent renderer-side parsing bug.
 */
export function getAppInfo(): AppInfo {
  const platform = process.platform
  if (platform !== 'linux' && platform !== 'win32' && platform !== 'darwin') {
    throw new Error(`Unsupported platform: ${platform}`)
  }

  return appInfoSchema.parse({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? 'unknown',
    chromeVersion: process.versions.chrome ?? 'unknown',
    nodeVersion: process.versions.node ?? 'unknown',
    platform,
    arch: process.arch
  })
}
