import { existsSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MutationCommandResult } from '@main/adb/adb-client'
import type { RawApkInfo } from '@main/android/apk-parser-loader'
import type { DeviceTransferProgressUpdate } from '@shared/validation/device-transfer.schema'
import {
  analyzeDeviceTransfer,
  isUserStorageApkPath,
  performDeviceTransfer
} from '@main/android/device-transfer.service'
import { runMigrations } from '@main/persistence/migrations'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SOURCE = 'SOURCE01'
const TARGET = 'TARGET02'
const PKG = 'com.citibanamex.banamexmobile'
const APP_DIR = `/data/app/~~abc==/${PKG}-xyz==`
const PM_PATH = `${SOURCE}\npm path ${PKG}`
const VERSIONCODE_ARGS = `${TARGET}\npm list packages --show-versioncode ${PKG}`

const SOURCE_FILES = ['base.apk', 'split_config.arm64_v8a.apk', 'split_config.xxhdpi.apk']

function pmPathOutput(fileNames = SOURCE_FILES, dir = APP_DIR): string {
  return fileNames.map((name) => `package:${dir}/${name}`).join('\n')
}

function baseApk(overrides: Partial<RawApkInfo> = {}): RawApkInfo {
  return {
    package: PKG,
    versionName: '136.0.0',
    versionCode: 184,
    usesSdk: { minSdkVersion: 26, targetSdkVersion: 35 },
    application: { label: ['Banamex'] },
    ...overrides
  }
}

function configSplit(split: string, overrides: Partial<RawApkInfo> = {}): RawApkInfo {
  return {
    package: PKG,
    versionName: null,
    versionCode: 184,
    usesSdk: null,
    application: {},
    split,
    ...overrides
  }
}

function fakeParser(responses: Record<string, RawApkInfo>): (path: string) => Promise<RawApkInfo> {
  return async (path: string) => {
    const response = responses[basename(path)]
    if (!response) {
      throw new Error(`fakeParser: no response configured for "${basename(path)}"`)
    }
    return response
  }
}

const DEFAULT_PARSER = fakeParser({
  'base.apk': baseApk(),
  'split_config.arm64_v8a.apk': configSplit('config.arm64_v8a'),
  'split_config.xxhdpi.apk': configSplit('config.xxhdpi')
})

function stagingDirOf(adb: FakeAdbClient): string {
  const localPath = adb.pullCalls[0]?.localPath
  if (!localPath) {
    throw new Error('nothing was pulled')
  }
  return dirname(localPath)
}

describe('isUserStorageApkPath', () => {
  it('accepts /data/app and adopted-storage paths', () => {
    expect(isUserStorageApkPath(`${APP_DIR}/base.apk`)).toBe(true)
    expect(isUserStorageApkPath('/mnt/expand/1234-abcd/app/~~x/pkg-y/base.apk')).toBe(true)
  })

  it('rejects preinstalled and traversal paths', () => {
    expect(isUserStorageApkPath('/product/app/Gmail2/Gmail2.apk')).toBe(false)
    expect(isUserStorageApkPath('/system/priv-app/Settings/Settings.apk')).toBe(false)
    expect(isUserStorageApkPath('/data/app/../../system/app/x.apk')).toBe(false)
    expect(isUserStorageApkPath('/data/application/x.apk')).toBe(false)
  })
})

describe('analyzeDeviceTransfer', () => {
  let adb: FakeAdbClient

  beforeEach(() => {
    adb = new FakeAdbClient()
    adb.pullWritesFiles = true
    adb.deviceProperties.set(
      TARGET,
      new Map([
        ['ro.product.cpu.abilist', 'arm64-v8a,armeabi-v7a'],
        ['ro.build.version.sdk', '36']
      ])
    )
    adb.shellResponses.set(PM_PATH, pmPathOutput())
    adb.shellResponses.set(VERSIONCODE_ARGS, '')
  })

  it('pulls every file from the source and analyzes them against the target', async () => {
    const analysis = await analyzeDeviceTransfer(adb, SOURCE, TARGET, PKG, DEFAULT_PARSER)

    expect(adb.pullCalls.map((call) => call.serial)).toEqual([SOURCE, SOURCE, SOURCE])
    expect(adb.pullCalls.map((call) => call.remotePath)).toEqual(
      SOURCE_FILES.map((name) => `${APP_DIR}/${name}`)
    )
    expect(analysis.canInstall).toBe(true)
    expect(analysis.packageName).toBe(PKG)
    expect(analysis.versionCode).toBe(184)
    expect(analysis.devicePrimaryAbi).toBe('arm64-v8a')
    expect(analysis.parts.map((part) => part.fileName)).toEqual(SOURCE_FILES)
    expect(analysis.plan).toEqual({ operation: 'fresh-install', currentVersionCode: null })
    expect(existsSync(stagingDirOf(adb))).toBe(false)
  })

  it('reports each pulled file while analyzing', async () => {
    const progress: DeviceTransferProgressUpdate[] = []

    await analyzeDeviceTransfer(adb, SOURCE, TARGET, PKG, DEFAULT_PARSER, (update) => {
      progress.push(update)
    })

    expect(progress).toEqual([
      { phase: 'pulling', fileName: 'base.apk', fileNumber: 1, totalFiles: 3 },
      {
        phase: 'pulling',
        fileName: 'split_config.arm64_v8a.apk',
        fileNumber: 2,
        totalFiles: 3
      },
      {
        phase: 'pulling',
        fileName: 'split_config.xxhdpi.apk',
        fileNumber: 3,
        totalFiles: 3
      },
      { phase: 'checking' }
    ])
  })

  it('reports an ABI mismatch with the target as a blocking issue', async () => {
    adb.deviceProperties.set(
      TARGET,
      new Map([
        ['ro.product.cpu.abilist', 'x86_64'],
        ['ro.build.version.sdk', '36']
      ])
    )

    const analysis = await analyzeDeviceTransfer(adb, SOURCE, TARGET, PKG, DEFAULT_PARSER)

    expect(analysis.canInstall).toBe(false)
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'no-compatible-abi-split', severity: 'error' })
    )
  })

  it('refuses when source and target are the same device', async () => {
    await expect(analyzeDeviceTransfer(adb, SOURCE, SOURCE, PKG, DEFAULT_PARSER)).rejects.toThrow(
      /must be different/
    )
    expect(adb.pullCalls).toHaveLength(0)
  })

  it('refuses an invalid package name before running any adb command', async () => {
    await expect(
      analyzeDeviceTransfer(adb, SOURCE, TARGET, 'com.example;reboot', DEFAULT_PARSER)
    ).rejects.toThrow(/invalid package name/)
    expect(adb.pullCalls).toHaveLength(0)
  })

  it('refuses an app that is not installed on the source', async () => {
    adb.shellResponses.set(PM_PATH, '')

    await expect(analyzeDeviceTransfer(adb, SOURCE, TARGET, PKG, DEFAULT_PARSER)).rejects.toThrow(
      /not installed on the source/
    )
  })

  it('refuses a preinstalled app outside user storage', async () => {
    adb.shellResponses.set(PM_PATH, 'package:/product/app/Banamex/Banamex.apk')

    await expect(analyzeDeviceTransfer(adb, SOURCE, TARGET, PKG, DEFAULT_PARSER)).rejects.toThrow(
      /user storage/
    )
    expect(adb.pullCalls).toHaveLength(0)
  })

  it('refuses duplicate file names', async () => {
    adb.shellResponses.set(
      PM_PATH,
      `package:${APP_DIR}/base.apk\npackage:/data/app/~~other/${PKG}-2/base.apk`
    )

    await expect(analyzeDeviceTransfer(adb, SOURCE, TARGET, PKG, DEFAULT_PARSER)).rejects.toThrow(
      /same name/
    )
  })

  it('removes the staging directory when a pull fails', async () => {
    adb.pullResponses.set(`${SOURCE}\n${APP_DIR}/split_config.xxhdpi.apk`, new Error('pull broke'))

    await expect(analyzeDeviceTransfer(adb, SOURCE, TARGET, PKG, DEFAULT_PARSER)).rejects.toThrow(
      'pull broke'
    )
    expect(existsSync(stagingDirOf(adb))).toBe(false)
  })
})

describe('performDeviceTransfer', () => {
  let db: Database.Database
  let adb: FakeAdbClient
  let installCalls: Array<{ serial: string; apkPaths: string[]; allExist: boolean }>
  let installResult: MutationCommandResult | Error

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    adb = new FakeAdbClient()
    adb.pullWritesFiles = true
    adb.deviceProperties.set(
      TARGET,
      new Map([
        ['ro.product.cpu.abilist', 'arm64-v8a,armeabi-v7a'],
        ['ro.build.version.sdk', '36']
      ])
    )
    adb.shellResponses.set(PM_PATH, pmPathOutput())
    adb.shellResponses.set(VERSIONCODE_ARGS, ['', '', `package:${PKG} versionCode:184`])
    installCalls = []
    installResult = { exitCode: 0, stdout: 'Success\n', stderr: '' }
    // The staging directory's name is random, so the fake's argv-keyed
    // mutation map can't be preconfigured — this records the call instead.
    vi.spyOn(adb, 'installMultipleApks').mockImplementation(async (serial, apkPaths) => {
      installCalls.push({ serial, apkPaths, allExist: apkPaths.every((p) => existsSync(p)) })
      if (installResult instanceof Error) {
        throw installResult
      }
      return installResult
    })
  })

  afterEach(() => {
    db.close()
  })

  function perform(
    expectedVersionCode: number | null = 184,
    parser = DEFAULT_PARSER,
    onProgress?: (progress: DeviceTransferProgressUpdate) => void
  ) {
    return performDeviceTransfer(
      db,
      adb,
      SOURCE,
      TARGET,
      PKG,
      expectedVersionCode,
      'Copied from samsung SM-F766B (SOURCE01).',
      parser,
      onProgress
    )
  }

  it('installs every pulled file on the target and records where it came from', async () => {
    const result = await perform()

    expect(result.success).toBe(true)
    expect(installCalls).toHaveLength(1)
    expect(installCalls[0]?.serial).toBe(TARGET)
    expect(installCalls[0]?.apkPaths.map((p) => basename(p))).toEqual(SOURCE_FILES)
    expect(installCalls[0]?.allExist).toBe(true)
    expect(existsSync(stagingDirOf(adb))).toBe(false)

    const history = db.prepare('SELECT * FROM operation_history').all() as Array<{
      device_id: string
      source_device_id: string | null
      operation: string
      raw_output: string
    }>
    expect(history).toHaveLength(1)
    expect(history[0]?.device_id).toBe(TARGET)
    expect(history[0]?.source_device_id).toBe(SOURCE)
    expect(history[0]?.operation).toBe('split-install')
    expect(history[0]?.raw_output).toMatch(/^Copied from samsung SM-F766B \(SOURCE01\)\./)
  })

  it('keeps a density split that does not match the target screen', async () => {
    adb.shellResponses.set(`${TARGET}\nwm density`, 'Physical density: 240')

    await perform()

    expect(installCalls[0]?.apkPaths.map((p) => basename(p))).toContain('split_config.xxhdpi.apk')
  })

  it('reports per-file pulls, validation, and installation progress', async () => {
    const progress: DeviceTransferProgressUpdate[] = []

    await perform(184, DEFAULT_PARSER, (update) => progress.push(update))

    expect(progress).toEqual([
      { phase: 'pulling', fileName: 'base.apk', fileNumber: 1, totalFiles: 3 },
      {
        phase: 'pulling',
        fileName: 'split_config.arm64_v8a.apk',
        fileNumber: 2,
        totalFiles: 3
      },
      {
        phase: 'pulling',
        fileName: 'split_config.xxhdpi.apk',
        fileNumber: 3,
        totalFiles: 3
      },
      { phase: 'checking' },
      { phase: 'installing', fileCount: 3 }
    ])
  })

  it('refuses when the source app changed since the analysis', async () => {
    await expect(perform(183)).rejects.toThrow(/still the version that was checked/)
    expect(installCalls).toHaveLength(0)
    expect(existsSync(stagingDirOf(adb))).toBe(false)
  })

  it('refuses when the version code could not be read', async () => {
    await expect(perform(null)).rejects.toThrow(/still the version that was checked/)
    expect(installCalls).toHaveLength(0)
  })

  it('refuses when the pulled files belong to another package', async () => {
    const parser = fakeParser({
      'base.apk': baseApk({ package: 'com.example.other' }),
      'split_config.arm64_v8a.apk': configSplit('config.arm64_v8a', {
        package: 'com.example.other'
      }),
      'split_config.xxhdpi.apk': configSplit('config.xxhdpi', { package: 'com.example.other' })
    })
    adb.shellResponses.set(`${TARGET}\npm list packages --show-versioncode com.example.other`, '')

    await expect(perform(184, parser)).rejects.toThrow(/belong to "com.example.other"/)
    expect(installCalls).toHaveLength(0)
  })

  it('refuses a set the target cannot install', async () => {
    adb.deviceProperties.set(
      TARGET,
      new Map([
        ['ro.product.cpu.abilist', 'arm64-v8a'],
        ['ro.build.version.sdk', '24']
      ])
    )

    await expect(perform()).rejects.toThrow(/requires Android API 26/)
    expect(installCalls).toHaveLength(0)
  })

  it('removes the staging directory when the install throws', async () => {
    installResult = new Error('adb died')

    await expect(perform()).rejects.toThrow('adb died')
    expect(existsSync(stagingDirOf(adb))).toBe(false)
  })

  it('reports a device-side install failure without throwing', async () => {
    installResult = {
      exitCode: 1,
      stdout: '',
      stderr: 'adb: failed to install: Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]'
    }

    const result = await perform()

    expect(result.success).toBe(false)
    expect(existsSync(stagingDirOf(adb))).toBe(false)
  })
})
