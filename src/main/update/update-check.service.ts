import type Database from 'better-sqlite3'
import { GITHUB_RELEASES_URL, GITHUB_REPOSITORY } from '@shared/constants/repository'
import type { UpdateStatus } from '@shared/validation/update.schema'
import { getSetting, setSetting } from '../persistence/settings.repository'
import { compareVersions, parseVersion } from './semver'

export const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

const LATEST_VERSION_KEY = 'update_check.latest_version'
const CHECKED_AT_KEY = 'update_check.checked_at'

export interface HttpJsonResponse {
  statusCode: number
  body: string
}

/** GET a URL and return status + raw body; rejects on network failure. */
export type FetchJson = (url: string) => Promise<HttpJsonResponse>

/**
 * Asks GitHub for the newest published release at most once a day and
 * reports whether it's newer than the running app. `/releases/latest`
 * never returns drafts or prereleases, so stable users are only told about
 * stable releases (and a beta user is told once the stable release ships).
 *
 * Failures — offline, rate-limited (HTTP 403/429), unexpected payload —
 * never throw to the caller: the last known result is returned instead and
 * the timestamp isn't advanced, so the next app start simply tries again.
 */
export class UpdateCheckService {
  constructor(
    private readonly db: Database.Database,
    private readonly fetchJson: FetchJson,
    private readonly currentVersion: string,
    private readonly now: () => number = Date.now
  ) {}

  async getStatus(): Promise<UpdateStatus> {
    const checkedAt = Number(getSetting(this.db, CHECKED_AT_KEY)) || null
    if (checkedAt === null || this.now() - checkedAt >= CHECK_INTERVAL_MS) {
      await this.refresh()
    }
    return this.cachedStatus()
  }

  private async refresh(): Promise<void> {
    try {
      const response = await this.fetchJson(LATEST_RELEASE_API_URL)
      if (response.statusCode !== 200) {
        return
      }
      const payload = JSON.parse(response.body) as { tag_name?: unknown }
      if (typeof payload.tag_name !== 'string' || !parseVersion(payload.tag_name)) {
        return
      }
      setSetting(this.db, LATEST_VERSION_KEY, payload.tag_name.replace(/^v/, ''))
      setSetting(this.db, CHECKED_AT_KEY, String(this.now()))
    } catch {
      // Offline or malformed body: keep the previous result.
    }
  }

  private cachedStatus(): UpdateStatus {
    const latestVersion = getSetting(this.db, LATEST_VERSION_KEY)
    const checkedAt = Number(getSetting(this.db, CHECKED_AT_KEY)) || null
    const updateAvailable =
      latestVersion !== null &&
      parseVersion(this.currentVersion) !== null &&
      compareVersions(latestVersion, this.currentVersion) > 0

    return {
      currentVersion: this.currentVersion,
      latestVersion,
      updateAvailable,
      releaseUrl: latestVersion ? `${GITHUB_RELEASES_URL}/tag/v${latestVersion}` : null,
      checkedAt
    }
  }
}
