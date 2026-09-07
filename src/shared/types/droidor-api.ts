import type { AppInfo } from './app-info'

/**
 * Contract for the API the preload script exposes on window.droidor.
 * Defined here (not derived from the preload implementation) so the
 * renderer depends only on this shared contract, never on preload internals.
 */
export interface DroidorApi {
  getAppInfo: () => Promise<AppInfo>
}
