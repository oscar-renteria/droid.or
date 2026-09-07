import { createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ZipFile } from 'yazl'
import {
  downloadAndInstallPlatformTools,
  getManagedAdbPath,
  getManagedAdbRoot,
  getPlatformToolsTarget,
  isManagedAdbInstalled,
  platformToolsDownloadUrl
} from '@main/adb/platform-tools-manager'

describe('getPlatformToolsTarget', () => {
  it('maps win32 to the windows build, with the .exe binary name', () => {
    expect(getPlatformToolsTarget('win32', 'x64')).toEqual({
      googleOsName: 'windows',
      binaryName: 'adb.exe'
    })
  })

  it('maps darwin to the darwin build regardless of arch', () => {
    expect(getPlatformToolsTarget('darwin', 'arm64')).toEqual({
      googleOsName: 'darwin',
      binaryName: 'adb'
    })
    expect(getPlatformToolsTarget('darwin', 'x64')).toEqual({
      googleOsName: 'darwin',
      binaryName: 'adb'
    })
  })

  it('maps linux x64 to the linux build', () => {
    expect(getPlatformToolsTarget('linux', 'x64')).toEqual({
      googleOsName: 'linux',
      binaryName: 'adb'
    })
  })

  it('has no managed build for linux on any other architecture', () => {
    expect(getPlatformToolsTarget('linux', 'arm64')).toBeNull()
    expect(getPlatformToolsTarget('linux', 'ia32')).toBeNull()
  })

  it('has no managed build for an unrecognized platform', () => {
    expect(getPlatformToolsTarget('freebsd', 'x64')).toBeNull()
  })
})

describe('platformToolsDownloadUrl', () => {
  it('points at the official dl.google.com distribution, never a mirror', () => {
    const url = platformToolsDownloadUrl({ googleOsName: 'linux', binaryName: 'adb' })
    expect(url).toBe('https://dl.google.com/android/repository/platform-tools-latest-linux.zip')
  })
})

/** Builds a tiny fake "adb" that a real child process can execute and that
 *  genuinely prints the exact string verifyAdb looks for — so tests below
 *  exercise real process spawning and real regex matching, not a mock of
 *  either. */
async function buildFakeAdbZip(zipPath: string, printsValidVersion: boolean): Promise<void> {
  const script = printsValidVersion
    ? '#!/bin/sh\necho "Android Debug Bridge version 1.0.41"\n'
    : '#!/bin/sh\necho "not adb"\n'

  const zipfile = new ZipFile()
  zipfile.addBuffer(Buffer.from(script), 'platform-tools/adb', { mode: 0o100755 })
  zipfile.addBuffer(Buffer.from('fake NOTICE'), 'platform-tools/NOTICE.txt')

  await new Promise<void>((resolvePromise, reject) => {
    zipfile.outputStream
      .pipe(createWriteStream(zipPath))
      .on('close', () => resolvePromise())
      .on('error', reject)
    zipfile.end()
  })
}

const LINUX_TARGET = { googleOsName: 'linux' as const, binaryName: 'adb' as const }

describe('downloadAndInstallPlatformTools', () => {
  let userDataDir: string
  let fixtureZip: string

  beforeEach(async () => {
    userDataDir = await mkdtemp(join(tmpdir(), 'droid-or-platform-tools-userdata-'))
  })

  afterEach(async () => {
    await rm(userDataDir, { recursive: true, force: true })
    if (fixtureZip) {
      await rm(fixtureZip, { force: true })
    }
  })

  it('installs a valid downloaded archive as the managed adb', async () => {
    fixtureZip = join(await mkdtemp(join(tmpdir(), 'droid-or-fixture-')), 'platform-tools.zip')
    await buildFakeAdbZip(fixtureZip, true)

    const fakeDownload = async (_url: string, destPath: string): Promise<void> => {
      await copyFile(fixtureZip, destPath)
    }

    const result = await downloadAndInstallPlatformTools(userDataDir, LINUX_TARGET, fakeDownload)

    expect(result.version).toBe('1.0.41')
    expect(result.adbPath).toBe(getManagedAdbPath(userDataDir, LINUX_TARGET))
    expect(isManagedAdbInstalled(userDataDir, LINUX_TARGET)).toBe(true)
    expect(existsSync(join(getManagedAdbRoot(userDataDir), 'NOTICE.txt'))).toBe(true)
  })

  it('rejects an archive whose adb binary fails verification, and installs nothing', async () => {
    fixtureZip = join(await mkdtemp(join(tmpdir(), 'droid-or-fixture-')), 'platform-tools.zip')
    await buildFakeAdbZip(fixtureZip, false)

    const fakeDownload = async (_url: string, destPath: string): Promise<void> => {
      await copyFile(fixtureZip, destPath)
    }

    await expect(
      downloadAndInstallPlatformTools(userDataDir, LINUX_TARGET, fakeDownload)
    ).rejects.toThrow(/failed verification/)

    expect(isManagedAdbInstalled(userDataDir, LINUX_TARGET)).toBe(false)
  })

  it('rejects an archive with no adb binary at the expected path', async () => {
    const emptyZipDir = await mkdtemp(join(tmpdir(), 'droid-or-fixture-empty-'))
    fixtureZip = join(emptyZipDir, 'platform-tools.zip')
    const zipfile = new ZipFile()
    zipfile.addBuffer(Buffer.from('nothing useful'), 'platform-tools/README')
    await new Promise<void>((resolvePromise, reject) => {
      zipfile.outputStream
        .pipe(createWriteStream(fixtureZip))
        .on('close', () => resolvePromise())
        .on('error', reject)
      zipfile.end()
    })

    const fakeDownload = async (_url: string, destPath: string): Promise<void> => {
      await copyFile(fixtureZip, destPath)
    }

    await expect(
      downloadAndInstallPlatformTools(userDataDir, LINUX_TARGET, fakeDownload)
    ).rejects.toThrow(/did not contain an adb executable/)
  })

  it('keeps the previous managed install if a later re-download fails verification', async () => {
    const goodZipDir = await mkdtemp(join(tmpdir(), 'droid-or-fixture-good-'))
    const goodZip = join(goodZipDir, 'good.zip')
    await buildFakeAdbZip(goodZip, true)
    await downloadAndInstallPlatformTools(userDataDir, LINUX_TARGET, async (_url, destPath) => {
      await copyFile(goodZip, destPath)
    })
    await rm(goodZipDir, { recursive: true, force: true })

    const badZipDir = await mkdtemp(join(tmpdir(), 'droid-or-fixture-bad-'))
    fixtureZip = join(badZipDir, 'bad.zip')
    await buildFakeAdbZip(fixtureZip, false)

    await expect(
      downloadAndInstallPlatformTools(userDataDir, LINUX_TARGET, async (_url, destPath) => {
        await copyFile(fixtureZip, destPath)
      })
    ).rejects.toThrow(/failed verification/)

    // The good install from before is still there — a failed update never
    // tears down a working one.
    expect(isManagedAdbInstalled(userDataDir, LINUX_TARGET)).toBe(true)
  })
})
