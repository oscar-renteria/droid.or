import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inspectLocalApk } from '@main/android/local-apk-inspector'
import type { RawApkInfo } from '@main/android/apk-parser-loader'

const VALID_RAW: RawApkInfo = {
  package: 'com.example.app',
  versionName: '2.1.0',
  versionCode: 210,
  usesSdk: { minSdkVersion: 24, targetSdkVersion: 34 },
  application: { label: ['Example App', 'Example App'] }
}

describe('inspectLocalApk', () => {
  let workDir: string
  let apkPath: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'droid-or-local-apk-test-'))
    apkPath = join(workDir, 'test.apk')
    await writeFile(apkPath, Buffer.from('fake content, real bytes never read by the fake parser'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  it('resolves a full LocalApkInfo for a well-formed APK', async () => {
    const info = await inspectLocalApk(apkPath, async () => VALID_RAW)

    expect(info).toEqual({
      filePath: apkPath,
      fileName: 'test.apk',
      fileSizeBytes: expect.any(Number),
      packageName: 'com.example.app',
      versionName: '2.1.0',
      versionCode: 210,
      minSdkVersion: 24,
      targetSdkVersion: 34,
      label: 'Example App',
      iconDataUrl: null
    })
  })

  it('rejects a file that is not named .apk before even trying to parse it', async () => {
    const notApk = join(workDir, 'test.txt')
    await writeFile(notApk, 'hello')

    await expect(inspectLocalApk(notApk, async () => VALID_RAW)).rejects.toThrow(
      /Only \.apk files are supported/
    )
  })

  it('wraps a parse failure with a clear, honest message', async () => {
    await expect(
      inspectLocalApk(apkPath, async () => {
        throw new Error('not a zip file')
      })
    ).rejects.toThrow(/couldn't be read as an APK: not a zip file/)
  })

  it('rejects a parsed APK with no usable package name', async () => {
    await expect(
      inspectLocalApk(apkPath, async () => ({ ...VALID_RAW, package: '' }))
    ).rejects.toThrow(/no usable package name/)
  })

  it('rejects a parsed APK whose package name is invalid', async () => {
    await expect(
      inspectLocalApk(apkPath, async () => ({ ...VALID_RAW, package: '../../evil' }))
    ).rejects.toThrow(/no usable package name/)
  })

  it('defaults missing optional fields to null rather than leaving them undefined', async () => {
    const info = await inspectLocalApk(apkPath, async () => ({
      package: 'com.example.minimal',
      versionName: null,
      versionCode: null,
      usesSdk: null,
      application: {}
    }))

    expect(info.versionName).toBeNull()
    expect(info.versionCode).toBeNull()
    expect(info.minSdkVersion).toBeNull()
    expect(info.targetSdkVersion).toBeNull()
    expect(info.label).toBeNull()
    expect(info.iconDataUrl).toBeNull()
  })
})
