import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AdbSettingsService } from '@main/adb/adb-settings.service'
import { DeviceRegistry } from '@main/android/device-registry'
import { runMigrations } from '@main/persistence/migrations'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

/** A real, directly-executable "adb" script — setCustomPath validates via
 *  the real verifyAdb (a real child process spawn), not through the
 *  injectable AdbClient, so this needs to genuinely run. */
async function writeFakeAdbScript(path: string, valid: boolean): Promise<void> {
  const script = valid
    ? '#!/bin/sh\necho "Android Debug Bridge version 9.9.9"\n'
    : '#!/bin/sh\necho "not adb at all"\n'
  await writeFile(path, script)
  await chmod(path, 0o755)
}

describe('AdbSettingsService', () => {
  let db: Database.Database
  let adb: FakeAdbClient
  let registry: DeviceRegistry
  let service: AdbSettingsService
  let userDataDir: string

  beforeEach(async () => {
    db = new Database(':memory:')
    runMigrations(db)
    adb = new FakeAdbClient()
    registry = new DeviceRegistry(db, adb)
    registry.start()
    userDataDir = await mkdtemp(join(tmpdir(), 'droid-or-adb-settings-test-'))
    service = new AdbSettingsService(db, adb, registry, userDataDir)
  })

  afterEach(async () => {
    registry.stop()
    db.close()
    await rm(userDataDir, { recursive: true, force: true })
  })

  it('reports system PATH as the source when nothing is configured', async () => {
    const status = await service.getStatus()
    expect(status.source).toBe('system')
    expect(status.resolvedPath).toBe('adb')
    expect(status.customPath).toBeNull()
    expect(status.managedInstalled).toBe(false)
  })

  // The fake adb is a shell script, which Windows cannot execute.
  it.skipIf(process.platform === 'win32')(
    'accepts and persists a valid custom path, switching the live AdbClient over to it',
    async () => {
      const scriptPath = join(userDataDir, 'my-adb')
      await writeFakeAdbScript(scriptPath, true)

      const watchCallsBefore = adb.watchCallCount
      const status = await service.setCustomPath(scriptPath)

      expect(status.source).toBe('custom')
      expect(status.customPath).toBe(scriptPath)
      expect(status.resolvedPath).toBe(scriptPath)
      expect(adb.adbCommandHistory).toContain(scriptPath)
      // The device watch was restarted to pick up the new binary.
      expect(adb.watchCallCount).toBeGreaterThan(watchCallsBefore)

      // Persisted, not just applied in memory: a fresh status read agrees.
      const reread = await service.getStatus()
      expect(reread.customPath).toBe(scriptPath)
    }
  )

  it('rejects a custom path that fails verification, without persisting it', async () => {
    const scriptPath = join(userDataDir, 'broken-adb')
    await writeFakeAdbScript(scriptPath, false)

    await expect(service.setCustomPath(scriptPath)).rejects.toThrow(
      /doesn't look like a working adb executable/
    )

    const status = await service.getStatus()
    expect(status.customPath).toBeNull()
    expect(status.source).toBe('system')
  })

  it.skipIf(process.platform === 'win32')(
    'clears a previously set custom path when passed null',
    async () => {
      const scriptPath = join(userDataDir, 'my-adb')
      await writeFakeAdbScript(scriptPath, true)
      await service.setCustomPath(scriptPath)

      const status = await service.setCustomPath(null)

      expect(status.customPath).toBeNull()
      expect(status.source).toBe('system')
    }
  )
})
