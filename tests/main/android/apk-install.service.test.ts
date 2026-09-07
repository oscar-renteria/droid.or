import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getInstallPlan, installLocalApk } from '@main/android/apk-install.service'
import type { LocalApkInfo } from '@main/android/local-apk-inspector'
import { runMigrations } from '@main/persistence/migrations'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'
const PKG = 'com.example.app'
const APK_PATH = '/home/user/Downloads/app.apk'

function localApk(overrides: Partial<LocalApkInfo> = {}): LocalApkInfo {
  return {
    filePath: APK_PATH,
    fileName: 'app.apk',
    fileSizeBytes: 12345,
    packageName: PKG,
    versionName: '2.0.0',
    versionCode: 20,
    minSdkVersion: 24,
    targetSdkVersion: 34,
    label: 'Example App',
    iconDataUrl: null,
    ...overrides
  }
}

const VERSIONCODE_ARGS = `pm list packages --show-versioncode ${PKG}`

describe('getInstallPlan', () => {
  let adb: FakeAdbClient

  beforeEach(() => {
    adb = new FakeAdbClient()
  })

  it('reports a fresh install when the package is not currently installed', async () => {
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')

    const plan = await getInstallPlan(adb, SERIAL, localApk())
    expect(plan).toEqual({ operation: 'fresh-install', currentVersionCode: null })
  })

  it('reports an update when the local version code is higher', async () => {
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, `package:${PKG} versionCode:10`)

    const plan = await getInstallPlan(adb, SERIAL, localApk({ versionCode: 20 }))
    expect(plan).toEqual({ operation: 'update', currentVersionCode: 10 })
  })

  it('reports reinstall-same-version when the version codes match exactly', async () => {
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, `package:${PKG} versionCode:20`)

    const plan = await getInstallPlan(adb, SERIAL, localApk({ versionCode: 20 }))
    expect(plan).toEqual({ operation: 'reinstall-same-version', currentVersionCode: 20 })
  })

  it('reports a downgrade attempt when the local version code is lower', async () => {
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, `package:${PKG} versionCode:30`)

    const plan = await getInstallPlan(adb, SERIAL, localApk({ versionCode: 20 }))
    expect(plan).toEqual({ operation: 'downgrade-attempt', currentVersionCode: 30 })
  })

  it('treats an unknown local version code as an update rather than guessing', async () => {
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, `package:${PKG} versionCode:30`)

    const plan = await getInstallPlan(adb, SERIAL, localApk({ versionCode: null }))
    expect(plan).toEqual({ operation: 'update', currentVersionCode: 30 })
  })
})

describe('installLocalApk', () => {
  let db: Database.Database
  let adb: FakeAdbClient

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    adb = new FakeAdbClient()
  })

  afterEach(() => {
    db.close()
  })

  it('installs successfully, verifying the new version code independently', async () => {
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, ['', `package:${PKG} versionCode:20`])
    adb.mutationResponses.set(`${SERIAL}\ninstall -r ${APK_PATH}`, {
      exitCode: 0,
      stdout: 'Performing Streamed Install\nSuccess\n',
      stderr: ''
    })

    const result = await installLocalApk(db, adb, SERIAL, localApk())

    expect(result.success).toBe(true)
    expect(result.message).toBe('App installed.')

    const history = db.prepare('SELECT * FROM operation_history').all() as Array<
      Record<string, unknown>
    >
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      device_id: SERIAL,
      package_name: PKG,
      operation: 'install',
      previous_state: 'not installed',
      new_state: 'version code 20',
      success: 1
    })
  })

  it('reports an update message when a prior version is already installed', async () => {
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, [
      `package:${PKG} versionCode:10`,
      `package:${PKG} versionCode:20`
    ])
    adb.mutationResponses.set(`${SERIAL}\ninstall -r ${APK_PATH}`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })

    const result = await installLocalApk(db, adb, SERIAL, localApk({ versionCode: 20 }))

    expect(result.success).toBe(true)
    expect(result.message).toBe('App updated.')
  })

  it('reports failure with the extracted reason when adb reports a failure', async () => {
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')
    adb.mutationResponses.set(`${SERIAL}\ninstall -r ${APK_PATH}`, {
      exitCode: 1,
      stdout: '',
      stderr:
        'adb: failed to install /home/user/Downloads/app.apk: Failure [INSTALL_FAILED_INVALID_APK]'
    })

    const result = await installLocalApk(db, adb, SERIAL, localApk())

    expect(result.success).toBe(false)
    expect(result.message).toBe('INSTALL_FAILED_INVALID_APK')

    const history = db.prepare('SELECT success FROM operation_history').all()
    expect(history).toEqual([{ success: 0 }])
  })

  it('reports failure when adb claims success but the package is not actually installed', async () => {
    // Before and after both say "not installed" — adb's exit code and
    // stdout claimed success, but nothing really changed.
    adb.shellResponses.set(`${SERIAL}\n${VERSIONCODE_ARGS}`, '')
    adb.mutationResponses.set(`${SERIAL}\ninstall -r ${APK_PATH}`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })

    const result = await installLocalApk(db, adb, SERIAL, localApk())

    expect(result.success).toBe(false)
    expect(result.message).toMatch(/doesn't appear to be installed/)
  })

  it('refuses to install a file with an invalid package name before making any ADB call', async () => {
    await expect(
      installLocalApk(db, adb, SERIAL, localApk({ packageName: 'com.evil; rm -rf /' }))
    ).rejects.toThrow(/invalid package name/)

    expect(adb.mutationCalls).toHaveLength(0)
    expect(db.prepare('SELECT COUNT(*) as c FROM operation_history').get()).toEqual({ c: 0 })
  })
})
