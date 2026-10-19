import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RawApkInfo } from '@main/android/apk-parser-loader'
import { runMigrations } from '@main/persistence/migrations'
import { buildSplitInstallAnalysis, performSplitInstall } from '@main/android/split-install.service'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'
const PKG = 'com.example.app'

function properties(overrides: Record<string, string> = {}): Map<string, string> {
  return new Map(
    Object.entries({
      'ro.product.cpu.abilist': 'arm64-v8a,armeabi-v7a,armeabi',
      'ro.build.version.sdk': '33',
      ...overrides
    })
  )
}

function fakeParser(
  responses: Record<string, RawApkInfo | Error>
): (path: string) => Promise<RawApkInfo> {
  return async (path: string) => {
    const fileName = basename(path)
    const response = responses[fileName]
    if (response instanceof Error) {
      throw response
    }
    if (!response) {
      throw new Error(`fakeParser: no response configured for "${fileName}"`)
    }
    return response
  }
}

/** A base APK's manifest never has a `split` attribute at all. */
function baseApk(overrides: Partial<RawApkInfo> = {}): RawApkInfo {
  return {
    package: PKG,
    versionName: '2.0.0',
    versionCode: 20,
    usesSdk: { minSdkVersion: 24, targetSdkVersion: 34 },
    application: { label: ['Example App'] },
    ...overrides
  }
}

/** A config split's manifest carries `split: "config.<qualifier>"` —
 *  the authoritative classification signal (see RawApkInfo.split). */
function configSplit(split: string, overrides: Partial<RawApkInfo> = {}): RawApkInfo {
  return {
    package: PKG,
    versionName: null,
    versionCode: 20,
    usesSdk: null,
    application: {},
    split,
    ...overrides
  }
}

const VERSIONCODE_ARGS = `pm list packages --show-versioncode ${PKG}`

describe('buildSplitInstallAnalysis', () => {
  let workDir: string
  let adb: FakeAdbClient

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'droid-or-split-install-test-'))
    adb = new FakeAdbClient()
    adb.deviceProperties.set(SERIAL, properties())
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  async function writeParts(names: string[]): Promise<string[]> {
    const paths = names.map((name) => join(workDir, name))
    await Promise.all(paths.map((path) => writeFile(path, 'x')))
    return paths
  }

  it('reports a clean, installable set for a well-formed base + matching ABI split', async () => {
    const paths = await writeParts(['base.apk', 'split_config.arm64_v8a.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({
        'base.apk': baseApk(),
        'split_config.arm64_v8a.apk': configSplit('config.arm64_v8a')
      })
    )

    expect(analysis.canInstall).toBe(true)
    expect(analysis.issues).toEqual([
      expect.objectContaining({ code: 'signing-consistency-not-verifiable', severity: 'info' })
    ])
    expect(analysis.packageName).toBe(PKG)
    expect(analysis.plan).toEqual({ operation: 'fresh-install', currentVersionCode: null })
    expect(analysis.parts.map((part) => part.fileName)).toEqual([
      'base.apk',
      'split_config.arm64_v8a.apk'
    ])
    expect(analysis.parts[1]).toMatchObject({
      role: 'abi',
      abi: 'arm64-v8a',
      deviceCompatible: true
    })
    // devicePrimaryAbi comes from the first entry of ro.product.cpu.abilist;
    // deviceDensityBucket is null since no `wm density` response was
    // configured for this test (the service degrades to null rather than
    // throwing when that query fails).
    expect(analysis.devicePrimaryAbi).toBe('arm64-v8a')
    expect(analysis.deviceDensityBucket).toBeNull()
  })

  it('exposes the device density bucket derived from `wm density`', async () => {
    const paths = await writeParts(['base.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')
    adb.shellResponses.set(`${SERIAL}\nwm density`, 'Physical density: 420')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({ 'base.apk': baseApk() })
    )

    expect(analysis.deviceDensityBucket).toBe('xxhdpi')
  })

  it('surfaces a downgrade attempt as its own warning issue, not just the header tag', async () => {
    const paths = await writeParts(['base.apk'])
    // The device already has a newer version code installed than this set.
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, `package:${PKG} versionCode:99`)

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({ 'base.apk': baseApk({ versionCode: 20 }) })
    )

    expect(analysis.plan).toEqual({ operation: 'downgrade-attempt', currentVersionCode: 99 })
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'downgrade-attempt', severity: 'warning' })
    )
    // A downgrade attempt is a warning, not a blocking error.
    expect(analysis.canInstall).toBe(true)
  })

  it('classifies role from the manifest split attribute, not the file name', async () => {
    // File names are deliberately misleading — the manifest metadata must
    // still win.
    const paths = await writeParts(['zzz-first.apk', 'aaa-second.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({
        'zzz-first.apk': baseApk(),
        'aaa-second.apk': configSplit('config.xxhdpi')
      })
    )

    expect(analysis.parts.find((part) => part.fileName === 'zzz-first.apk')?.role).toBe('base')
    expect(analysis.parts.find((part) => part.fileName === 'aaa-second.apk')).toMatchObject({
      role: 'density',
      density: 'xxhdpi'
    })
  })

  it('shows the raw split attribute for a part it cannot further classify (e.g. a feature module)', async () => {
    const paths = await writeParts(['base.apk', 'ads.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({ 'base.apk': baseApk(), 'ads.apk': configSplit('ads') })
    )

    expect(analysis.parts.find((part) => part.fileName === 'ads.apk')).toMatchObject({
      role: 'unknown',
      rawSplitAttribute: 'ads'
    })
  })

  it('flags a native-library split that does not match any device ABI as an error', async () => {
    const paths = await writeParts(['base.apk', 'split_config.x86_64.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({ 'base.apk': baseApk(), 'split_config.x86_64.apk': configSplit('config.x86_64') })
    )

    expect(analysis.canInstall).toBe(false)
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'no-compatible-abi-split', severity: 'error' })
    )
    expect(analysis.parts.find((part) => part.role === 'abi')).toMatchObject({
      deviceCompatible: false
    })
  })

  it('does not flag density/language splits as incompatible, regardless of device config', async () => {
    const paths = await writeParts(['base.apk', 'split_config.xxhdpi.apk', 'split_config.fr.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({
        'base.apk': baseApk(),
        'split_config.xxhdpi.apk': configSplit('config.xxhdpi'),
        'split_config.fr.apk': configSplit('config.fr')
      })
    )

    expect(analysis.canInstall).toBe(true)
    expect(analysis.parts.filter((part) => part.deviceCompatible)).toHaveLength(3)
  })

  it('flags a package name mismatch across parts as an error', async () => {
    const paths = await writeParts(['base.apk', 'split_config.en.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({
        'base.apk': baseApk(),
        'split_config.en.apk': configSplit('config.en', { package: 'com.other.app' })
      })
    )

    expect(analysis.canInstall).toBe(false)
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'package-name-mismatch', severity: 'error' })
    )
  })

  it('flags a version code mismatch as a warning, not a hard error', async () => {
    const paths = await writeParts(['base.apk', 'split_config.en.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({
        'base.apk': baseApk(),
        'split_config.en.apk': configSplit('config.en', { versionCode: 19 })
      })
    )

    expect(analysis.canInstall).toBe(true)
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'version-code-mismatch', severity: 'warning' })
    )
  })

  it('flags a min SDK requirement higher than the device as an error', async () => {
    const paths = await writeParts(['base.apk'])
    adb.deviceProperties.set(SERIAL, properties({ 'ro.build.version.sdk': '21' }))
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({ 'base.apk': baseApk() })
    )

    expect(analysis.canInstall).toBe(false)
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'min-sdk-too-high', severity: 'error' })
    )
  })

  it('blocks installation when no base APK can be found', async () => {
    const paths = await writeParts(['split_config.en.apk', 'split_config.fr.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({
        'split_config.en.apk': configSplit('config.en'),
        'split_config.fr.apk': configSplit('config.fr')
      })
    )

    expect(analysis.canInstall).toBe(false)
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'no-base-apk-detected', severity: 'error' })
    )
  })

  it('blocks installation when more than one file looks like a base APK', async () => {
    const paths = await writeParts(['base1.apk', 'base2.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({ 'base1.apk': baseApk(), 'base2.apk': baseApk() })
    )

    expect(analysis.canInstall).toBe(false)
    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'multiple-base-apks-detected', severity: 'error' })
    )
  })

  it('falls back to file-name classification only for a part that could not be parsed at all', async () => {
    const paths = await writeParts(['base.apk', 'split_config.en.apk'])
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'files',
      paths,
      fakeParser({ 'base.apk': baseApk(), 'split_config.en.apk': new Error('not a zip file') })
    )

    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'unreadable-part', severity: 'warning' })
    )
    // Still classified via the file-name fallback rather than left
    // entirely unclassified.
    expect(analysis.parts.find((part) => part.fileName === 'split_config.en.apk')).toMatchObject({
      role: 'language',
      language: 'en'
    })
    expect(analysis.canInstall).toBe(true)
  })

  it('surfaces an informational notice about non-APK content skipped from an archive', async () => {
    const { createWriteStream } = await import('node:fs')
    const { ZipFile } = await import('yazl')
    const archivePath = join(workDir, 'bundle.apks')
    await new Promise<void>((resolvePromise, reject) => {
      const zipfile = new ZipFile()
      zipfile.addBuffer(Buffer.from('base content'), 'base.apk')
      zipfile.addBuffer(Buffer.from('icon bytes'), 'icon.png')
      zipfile.addBuffer(Buffer.from('{}'), 'manifest.json')
      zipfile.outputStream
        .pipe(createWriteStream(archivePath))
        .on('close', () => resolvePromise())
        .on('error', reject)
      zipfile.end()
    })
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const analysis = await buildSplitInstallAnalysis(
      adb,
      SERIAL,
      'archive',
      [archivePath],
      fakeParser({ 'base.apk': baseApk() })
    )

    expect(analysis.issues).toContainEqual(
      expect.objectContaining({ code: 'non-apk-content-present', severity: 'info' })
    )
  })
})

describe('performSplitInstall', () => {
  let db: Database.Database
  let workDir: string
  let adb: FakeAdbClient

  beforeEach(async () => {
    db = new Database(':memory:')
    runMigrations(db)
    workDir = await mkdtemp(join(tmpdir(), 'droid-or-split-install-test-'))
    adb = new FakeAdbClient()
    adb.deviceProperties.set(SERIAL, properties())
  })

  afterEach(async () => {
    db.close()
    await rm(workDir, { recursive: true, force: true })
  })

  async function writeParts(names: string[]): Promise<string[]> {
    const paths = names.map((name) => join(workDir, name))
    await Promise.all(paths.map((path) => writeFile(path, 'x')))
    return paths
  }

  it('calls install-multiple with the base first, then splits in role order', async () => {
    const paths = await writeParts([
      'split_config.en.apk',
      'split_config.arm64_v8a.apk',
      'base.apk',
      'split_config.xxhdpi.apk'
    ])
    const basePath = paths.find((p) => p.endsWith('base.apk')) as string
    const abiPath = paths.find((p) => p.endsWith('arm64_v8a.apk')) as string
    const densityPath = paths.find((p) => p.endsWith('xxhdpi.apk')) as string
    const langPath = paths.find((p) => p.endsWith('en.apk')) as string

    const expectedArgs = ['install-multiple', '-r', basePath, abiPath, densityPath, langPath]
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, ['', `package:${PKG} versionCode:1`])
    adb.mutationResponses.set(`${SERIAL}\n${expectedArgs.join(' ')}`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })

    const result = await performSplitInstall(
      db,
      adb,
      SERIAL,
      'files',
      paths,
      paths.map((p) => basename(p)),
      fakeParser({
        'base.apk': baseApk(),
        'split_config.arm64_v8a.apk': configSplit('config.arm64_v8a'),
        'split_config.xxhdpi.apk': configSplit('config.xxhdpi'),
        'split_config.en.apk': configSplit('config.en')
      })
    )

    expect(result.success).toBe(true)
    expect(adb.mutationCalls).toContainEqual({
      serial: SERIAL,
      args: ['install-multiple', '-r', basePath, abiPath, densityPath, langPath]
    })
  })

  it('always installs the base even if it was left out of the selection', async () => {
    const paths = await writeParts(['base.apk', 'split_config.en.apk'])
    const basePath = paths[0] as string
    const langPath = paths[1] as string

    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, ['', `package:${PKG} versionCode:1`])
    adb.mutationResponses.set(`${SERIAL}\ninstall-multiple -r ${basePath} ${langPath}`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })

    const result = await performSplitInstall(
      db,
      adb,
      SERIAL,
      'files',
      paths,
      ['split_config.en.apk'], // base deliberately omitted
      fakeParser({ 'base.apk': baseApk(), 'split_config.en.apk': configSplit('config.en') })
    )

    expect(result.success).toBe(true)
    expect(adb.mutationCalls[0]?.args).toContain(basePath)
  })

  it('handles a file path containing spaces without breaking argv construction', async () => {
    const paths = await writeParts(['base app.apk'])
    const basePath = paths[0] as string

    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, ['', `package:${PKG} versionCode:1`])
    adb.mutationResponses.set(`${SERIAL}\ninstall-multiple -r ${basePath}`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })

    const result = await performSplitInstall(
      db,
      adb,
      SERIAL,
      'files',
      paths,
      ['base app.apk'],
      fakeParser({ 'base app.apk': baseApk() })
    )

    expect(result.success).toBe(true)
    // The space-containing path must survive as a single, untouched argv
    // element — never split on whitespace or shell-escaped, since this
    // goes straight to execFile's argv array, not a shell string.
    expect(adb.mutationCalls).toContainEqual({
      serial: SERIAL,
      args: ['install-multiple', '-r', basePath]
    })
  })

  it('reports a plain-language explanation alongside a known failure code', async () => {
    const paths = await writeParts(['base.apk'])
    const basePath = paths[0] as string

    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')
    adb.mutationResponses.set(`${SERIAL}\ninstall-multiple -r ${basePath}`, {
      exitCode: 1,
      stdout: '',
      stderr: 'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]'
    })

    const result = await performSplitInstall(
      db,
      adb,
      SERIAL,
      'files',
      paths,
      ['base.apk'],
      fakeParser({ 'base.apk': baseApk() })
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('INSTALL_FAILED_UPDATE_INCOMPATIBLE')
    expect(result.message).toContain('signed with a different certificate')
  })

  it('refuses to install a set whose only resolvable package name is invalid', async () => {
    const paths = await writeParts(['base.apk'])

    await expect(
      performSplitInstall(
        db,
        adb,
        SERIAL,
        'files',
        paths,
        ['base.apk'],
        fakeParser({ 'base.apk': baseApk({ package: 'com.evil; rm -rf /' }) })
      )
    ).rejects.toThrow(/invalid or missing package name/)

    expect(adb.mutationCalls).toHaveLength(0)
  })

  it('refuses to install when no base APK can be found', async () => {
    const paths = await writeParts(['split_config.en.apk'])

    await expect(
      performSplitInstall(
        db,
        adb,
        SERIAL,
        'files',
        paths,
        ['split_config.en.apk'],
        fakeParser({ 'split_config.en.apk': configSplit('config.en') })
      )
    ).rejects.toThrow(/No base APK was found/)

    expect(adb.mutationCalls).toHaveLength(0)
  })

  it('refuses to install when more than one file looks like a base APK', async () => {
    const paths = await writeParts(['base1.apk', 'base2.apk'])

    await expect(
      performSplitInstall(
        db,
        adb,
        SERIAL,
        'files',
        paths,
        ['base1.apk', 'base2.apk'],
        fakeParser({ 'base1.apk': baseApk(), 'base2.apk': baseApk() })
      )
    ).rejects.toThrow(/Found 2 files that all look like a base APK/)

    expect(adb.mutationCalls).toHaveLength(0)
  })

  it('records a split-install entry in operation history on success', async () => {
    const paths = await writeParts(['base.apk', 'split_config.arm64_v8a.apk'])
    const basePath = paths[0] as string
    const abiPath = paths[1] as string

    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, ['', `package:${PKG} versionCode:20`])
    adb.mutationResponses.set(`${SERIAL}\ninstall-multiple -r ${basePath} ${abiPath}`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })

    await performSplitInstall(
      db,
      adb,
      SERIAL,
      'files',
      paths,
      ['base.apk', 'split_config.arm64_v8a.apk'],
      fakeParser({
        'base.apk': baseApk(),
        'split_config.arm64_v8a.apk': configSplit('config.arm64_v8a')
      })
    )

    const history = db.prepare('SELECT * FROM operation_history').all() as Array<
      Record<string, unknown>
    >
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      device_id: SERIAL,
      package_name: PKG,
      operation: 'split-install',
      success: 1
    })
    expect(String(history[0]?.raw_output)).toContain('base.apk')
    expect(String(history[0]?.raw_output)).toContain('split_config.arm64_v8a.apk')
  })
})
