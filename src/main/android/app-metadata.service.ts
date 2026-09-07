import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import type { AdbClient } from '../adb/adb-client'
import {
  getCachedAppMetadata,
  setCachedAppMetadata
} from '../persistence/app-metadata-cache.repository'
import {
  extractApkMetadata as defaultExtractApkMetadata,
  type ApkMetadata
} from './apk-metadata-extractor'
import { ConcurrencyLimiter } from './concurrency-limiter'

const PULL_CONCURRENCY_LIMIT = 3

export interface AppMetadataRequest {
  serial: string
  packageName: string
  apkPath: string
  /** Cache key component. Metadata for a package with an unknown version
   *  is fetched fresh every time rather than cached, since there would be
   *  no reliable key to invalidate it by later. */
  versionCode: number | null
}

/**
 * Resolves an app's real label/icon by pulling its APK and parsing it —
 * the only way to get either, since no ADB shell command exposes them.
 * Concurrency-limited (at most 3 pulls at once) so requesting metadata for
 * many packages around the same time doesn't saturate the single USB
 * connection to the device, and results are cached in SQLite by
 * (package, version) so this cost is paid at most once per app version.
 */
export class AppMetadataService {
  private readonly limiter = new ConcurrencyLimiter(PULL_CONCURRENCY_LIMIT)
  private readonly inFlight = new Map<string, Promise<ApkMetadata>>()

  constructor(
    private readonly db: Database.Database,
    private readonly adbClient: AdbClient,
    private readonly extractApkMetadata: (
      path: string
    ) => Promise<ApkMetadata> = defaultExtractApkMetadata
  ) {}

  async getMetadata(request: AppMetadataRequest): Promise<ApkMetadata> {
    if (request.versionCode !== null) {
      const cached = getCachedAppMetadata(this.db, request.packageName, request.versionCode)
      if (cached) {
        return cached
      }
    }

    const cacheKey = `${request.packageName}:${request.versionCode ?? 'unknown'}`
    const existing = this.inFlight.get(cacheKey)
    if (existing) {
      return existing
    }

    const promise = this.limiter
      .run(() => this.pullAndExtract(request))
      .finally(() => {
        this.inFlight.delete(cacheKey)
      })
    this.inFlight.set(cacheKey, promise)
    return promise
  }

  private async pullAndExtract(request: AppMetadataRequest): Promise<ApkMetadata> {
    const tempPath = join(tmpdir(), `droid-or-${randomUUID()}.apk`)
    try {
      await this.adbClient.pullFile(request.serial, request.apkPath, tempPath)
      const metadata = await this.extractApkMetadata(tempPath)
      if (request.versionCode !== null) {
        setCachedAppMetadata(this.db, request.packageName, request.versionCode, metadata)
      }
      return metadata
    } catch {
      return { label: null, iconDataUrl: null }
    } finally {
      await rm(tempPath, { force: true })
    }
  }
}
