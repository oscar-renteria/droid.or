import { mkdir, mkdtemp, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupStaleSplitInstallTempDirs } from '@main/android/split-install-temp-cleanup'
import { SPLIT_INSTALL_TEMP_DIR_PREFIX } from '@main/android/split-apk-inspector'

/** These tests create real directories directly under the OS temp root
 *  (the same place the function under test scans) rather than under an
 *  isolated workDir, since the function's whole job is to scan tmpdir()
 *  itself. Every directory this creates is prefixed and cleaned up
 *  unconditionally in afterEach, regardless of what the function under
 *  test did with it. */
describe('cleanupStaleSplitInstallTempDirs', () => {
  const createdDirs: string[] = []

  async function makeTempDir(suffix: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), `${SPLIT_INSTALL_TEMP_DIR_PREFIX}${suffix}-`))
    createdDirs.push(dir)
    return dir
  }

  async function ageDir(dir: string, ageMs: number): Promise<void> {
    const past = new Date(Date.now() - ageMs)
    await utimes(dir, past, past)
  }

  afterEach(async () => {
    await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })))
    createdDirs.length = 0
  })

  it('removes a stale (older than an hour) leftover staging directory', async () => {
    const dir = await makeTempDir('stale-test')
    await writeFile(join(dir, 'base.apk'), 'x')
    await ageDir(dir, 2 * 60 * 60 * 1000)

    await cleanupStaleSplitInstallTempDirs()

    await expect(stat(dir)).rejects.toThrow()
  })

  it('leaves a fresh staging directory alone', async () => {
    const dir = await makeTempDir('fresh-test')
    await writeFile(join(dir, 'base.apk'), 'x')

    await cleanupStaleSplitInstallTempDirs()

    await expect(stat(dir)).resolves.toBeDefined()
  })

  it('never touches a directory that does not match the split-install prefix', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'droid-or-platform-tools-cleanup-test-'))
    createdDirs.push(dir)
    await ageDir(dir, 2 * 60 * 60 * 1000)

    await cleanupStaleSplitInstallTempDirs()

    await expect(stat(dir)).resolves.toBeDefined()
  })

  it('is a no-op that never throws when nothing matches', async () => {
    await expect(cleanupStaleSplitInstallTempDirs()).resolves.toBeUndefined()
  })

  it('removes nested contents recursively', async () => {
    const dir = await makeTempDir('nested-test')
    const nested = join(dir, 'splits')
    await mkdir(nested)
    await writeFile(join(nested, 'split.apk'), 'x')
    await ageDir(dir, 2 * 60 * 60 * 1000)

    await cleanupStaleSplitInstallTempDirs()

    await expect(readdir(tmpdir())).resolves.not.toContain(basename(dir))
  })
})
