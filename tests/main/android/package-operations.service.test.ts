import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { performPackageOperation } from '@main/android/package-operations.service'
import { runMigrations } from '@main/persistence/migrations'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'
const PKG = 'com.example.app'

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
    adb.shellResponses.set(`${SERIAL}\npm list packages -d ${PKG}`, ['', `package:${PKG}`])
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
    adb.shellResponses.set(`${SERIAL}\npm list packages -d ${PKG}`, '')
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
    adb.shellResponses.set(`${SERIAL}\npm list packages -d ${PKG}`, '')
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
    adb.shellResponses.set(`${SERIAL}\npm list packages -d ${PKG}`, [`package:${PKG}`, ''])
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
    adb.mutationResponses.set(`${SERIAL}\npm uninstall --user 0 ${PKG}`, {
      exitCode: 1,
      stdout: 'Failure [not installed for 0]\n',
      stderr: ''
    })

    const result = await performPackageOperation(db, adb, SERIAL, PKG, 'uninstall-for-user')
    expect(result.success).toBe(false)
    expect(result.message).toBe('not installed for 0')
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
