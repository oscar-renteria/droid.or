import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isPackageDisabled,
  isPackageInstalledForUser,
  performPackageOperation
} from '@main/android/package-operations.service'
import { runMigrations } from '@main/persistence/migrations'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'
const PKG = 'com.example.app'

describe('isPackageDisabled', () => {
  it('finds a disabled package that only appears once -u is included', async () => {
    // Reproduces a real finding on a real Android 10 tablet: a genuinely
    // disabled package (Gmail) was completely absent from
    // `pm list packages -d <pkg>` without `-u`, on a device where the
    // Android 16 device this app was first built against did not have
    // that gap. `-d` alone must never be trusted on its own again.
    const adb = new FakeAdbClient()
    adb.shellResponses.set(`${SERIAL}\npm list packages -d ${PKG}`, '')
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, `package:${PKG}`)

    expect(await isPackageDisabled(adb, SERIAL, PKG)).toBe(true)
  })

  it('is false for a package not present even with -u', async () => {
    const adb = new FakeAdbClient()
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')

    expect(await isPackageDisabled(adb, SERIAL, PKG)).toBe(false)
  })
})

describe('isPackageInstalledForUser', () => {
  it('is true for a disabled-but-installed package invisible to the plain query alone', async () => {
    // Same real-device gap as isPackageDisabled: a disabled package was
    // also absent from the plain (no -d, no -u) query on the same real
    // Android 10 tablet — this checks the -d -u query as a fallback.
    const adb = new FakeAdbClient()
    adb.shellResponses.set(`${SERIAL}\npm list packages ${PKG}`, '')
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, `package:${PKG}`)

    expect(await isPackageInstalledForUser(adb, SERIAL, PKG)).toBe(true)
  })

  it('is true for a plain enabled, installed package (the common case)', async () => {
    const adb = new FakeAdbClient()
    adb.shellResponses.set(`${SERIAL}\npm list packages ${PKG}`, `package:${PKG}`)
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')

    expect(await isPackageInstalledForUser(adb, SERIAL, PKG)).toBe(true)
  })

  it('is false for a package absent from both the plain and the disabled-but-installed query', async () => {
    const adb = new FakeAdbClient()
    adb.shellResponses.set(`${SERIAL}\npm list packages ${PKG}`, '')
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')

    expect(await isPackageInstalledForUser(adb, SERIAL, PKG)).toBe(false)
  })
})

describe('performPackageOperation', () => {
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

  it('disables a package, verifying the state actually changed', async () => {
    // Before: not in the disabled list. After: present in it.
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, ['', `package:${PKG}`])
    adb.mutationResponses.set(`${SERIAL}\npm disable-user --user 0 ${PKG}`, {
      exitCode: 0,
      stdout: `Package ${PKG} new state: disabled-user\n`,
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'disable')

    expect(result.success).toBe(true)
    expect(result.message).toBe('Package disabled for this user.')

    const history = db.prepare('SELECT * FROM operation_history').all() as Array<
      Record<string, unknown>
    >
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      device_id: SERIAL,
      package_name: PKG,
      operation: 'disable',
      previous_state: 'enabled',
      new_state: 'disabled',
      success: 1
    })
  })

  it('reports failure with the extracted message when the command itself fails', async () => {
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')
    adb.mutationResponses.set(`${SERIAL}\npm disable-user --user 0 ${PKG}`, {
      exitCode: 255,
      stdout: '',
      stderr: `\nException occurred while executing 'disable-user':\njava.lang.IllegalArgumentException: Unknown package: ${PKG}`
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'disable')

    expect(result.success).toBe(false)
    expect(result.message).toBe(`java.lang.IllegalArgumentException: Unknown package: ${PKG}`)

    const history = db.prepare('SELECT success FROM operation_history').all()
    expect(history).toEqual([{ success: 0 }])
  })

  it('reports failure when the command exits cleanly but the state did not actually change', async () => {
    // Before and after both say "not disabled" — the command claimed
    // success (exit 0) but nothing really happened.
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')
    adb.mutationResponses.set(`${SERIAL}\npm disable-user --user 0 ${PKG}`, {
      exitCode: 0,
      stdout: 'Package new state: disabled-user\n',
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'disable')

    expect(result.success).toBe(false)
    expect(result.message).toMatch(/did not actually change/)
  })

  it('enables a package, verifying it left the disabled list', async () => {
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, [`package:${PKG}`, ''])
    adb.mutationResponses.set(`${SERIAL}\npm enable --user 0 ${PKG}`, {
      exitCode: 0,
      stdout: `Package ${PKG} new state: enabled\n`,
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'enable')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Package enabled.')
  })

  it('uninstalls for the current user, verifying it left the visible package list', async () => {
    adb.shellResponses.set(`${SERIAL}\npm list packages ${PKG}`, [`package:${PKG}`, ''])
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')
    adb.mutationResponses.set(`${SERIAL}\npm uninstall --user 0 ${PKG}`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'uninstall-for-user')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Package uninstalled for this user.')
  })

  it('reports a real `pm uninstall` failure with its specific reason', async () => {
    adb.shellResponses.set(`${SERIAL}\npm list packages ${PKG}`, '')
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')
    adb.mutationResponses.set(`${SERIAL}\npm uninstall --user 0 ${PKG}`, {
      exitCode: 1,
      stdout: 'Failure [not installed for 0]\n',
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'uninstall-for-user')
    expect(result.success).toBe(false)
    expect(result.message).toBe('not installed for 0')
  })

  it('restores (reinstalls) a package for the current user, verifying it re-entered the visible package list', async () => {
    adb.shellResponses.set(`${SERIAL}\npm list packages ${PKG}`, ['', `package:${PKG}`])
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')
    adb.mutationResponses.set(`${SERIAL}\npm install-existing --user 0 ${PKG}`, {
      exitCode: 0,
      stdout: `Package ${PKG} installed for user: 0\n`,
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'restore-install')
    expect(result.success).toBe(true)
    expect(result.message).toBe('Package reinstalled for this user.')
  })

  it('reports a real `pm install-existing` failure for a package the device no longer knows about', async () => {
    adb.shellResponses.set(`${SERIAL}\npm list packages ${PKG}`, '')
    adb.shellResponses.set(`${SERIAL}\npm list packages -d -u ${PKG}`, '')
    adb.mutationResponses.set(`${SERIAL}\npm install-existing --user 0 ${PKG}`, {
      exitCode: 1,
      stdout: '',
      stderr: `android.content.pm.PackageManager$NameNotFoundException: Package ${PKG} doesn't exist`
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'restore-install')
    expect(result.success).toBe(false)
    expect(result.message).toBe(
      `android.content.pm.PackageManager$NameNotFoundException: Package ${PKG} doesn't exist`
    )
  })

  it('clears app data, trusting the device-reported result since there is nothing to independently verify', async () => {
    adb.mutationResponses.set(`${SERIAL}\npm clear --user 0 ${PKG}`, {
      exitCode: 0,
      stdout: 'Success\n',
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'clear-data')
    expect(result.success).toBe(true)
    // No shell query for clear-data's state at all — nothing configured
    // above besides the mutation itself, and it still resolves.
  })

  it('reports a real `pm clear` failure, which carries no specific reason', async () => {
    adb.mutationResponses.set(`${SERIAL}\npm clear --user 0 ${PKG}`, {
      exitCode: 1,
      stdout: 'Failed\n',
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'clear-data')
    expect(result.success).toBe(false)
    expect(result.message).toMatch(/without giving a specific reason/)
  })

  it('refuses an invalid package name before making any ADB call at all', async () => {
    await expect(
      performPackageOperation(db, adb, SERIAL, 'com.evil; rm -rf /', 'disable')
    ).rejects.toThrow(/invalid package name/)

    expect(adb.mutationCalls).toHaveLength(0)
    expect(db.prepare('SELECT COUNT(*) as c FROM operation_history').get()).toEqual({ c: 0 })
  })
})
