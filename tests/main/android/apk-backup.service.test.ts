import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupPackage, backupPackages } from '@main/android/apk-backup.service'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'

describe('backupPackage', () => {
  let adb: FakeAdbClient
  let destDir: string

  beforeEach(async () => {
    adb = new FakeAdbClient()
    destDir = await mkdtemp(join(tmpdir(), 'droid-or-backup-test-'))
  })

  afterEach(async () => {
    await rm(destDir, { recursive: true, force: true })
  })

  it('pulls every APK file for a split/bundle package into its own subfolder', async () => {
    const pkg = 'com.whatsapp'
    adb.shellResponses.set(
      `${SERIAL}\npm path ${pkg}`,
      [
        'package:/data/app/~~abc==/com.whatsapp-xyz==/base.apk',
        'package:/data/app/~~abc==/com.whatsapp-xyz==/split_config.arm64_v8a.apk'
      ].join('\n')
    )

    const result = await backupPackage(adb, SERIAL, pkg, destDir)

    expect(result.success).toBe(true)
    expect(result.files).toEqual([
      {
        remotePath: '/data/app/~~abc==/com.whatsapp-xyz==/base.apk',
        fileName: 'base.apk',
        success: true,
        errorMessage: null
      },
      {
        remotePath: '/data/app/~~abc==/com.whatsapp-xyz==/split_config.arm64_v8a.apk',
        fileName: 'split_config.arm64_v8a.apk',
        success: true,
        errorMessage: null
      }
    ])
    expect(existsSync(join(destDir, pkg))).toBe(true)
    expect(adb.pullCalls).toEqual([
      {
        serial: SERIAL,
        remotePath: '/data/app/~~abc==/com.whatsapp-xyz==/base.apk',
        localPath: join(destDir, pkg, 'base.apk')
      },
      {
        serial: SERIAL,
        remotePath: '/data/app/~~abc==/com.whatsapp-xyz==/split_config.arm64_v8a.apk',
        localPath: join(destDir, pkg, 'split_config.arm64_v8a.apk')
      }
    ])
  })

  it('reports failure when the package has no APK paths at all', async () => {
    const pkg = 'com.example.gone'
    adb.shellResponses.set(`${SERIAL}\npm path ${pkg}`, '')

    const result = await backupPackage(adb, SERIAL, pkg, destDir)

    expect(result.success).toBe(false)
    expect(result.files).toEqual([])
    expect(result.errorMessage).toMatch(/No APK files were found/)
  })

  it('reports per-file failure without failing the whole package result silently', async () => {
    const pkg = 'com.example.app'
    adb.shellResponses.set(
      `${SERIAL}\npm path ${pkg}`,
      ['package:/data/app/example/base.apk', 'package:/data/app/example/split_config.en.apk'].join(
        '\n'
      )
    )
    adb.pullResponses.set(
      `${SERIAL}\n/data/app/example/split_config.en.apk`,
      new Error('device offline')
    )

    const result = await backupPackage(adb, SERIAL, pkg, destDir)

    expect(result.success).toBe(false)
    expect(result.errorMessage).toMatch(/One or more files/)
    expect(result.files[0]).toMatchObject({ fileName: 'base.apk', success: true })
    expect(result.files[1]).toMatchObject({
      fileName: 'split_config.en.apk',
      success: false,
      errorMessage: 'device offline'
    })
  })

  it('refuses an invalid package name before making any ADB call', async () => {
    await expect(backupPackage(adb, SERIAL, 'com.evil; rm -rf /', destDir)).rejects.toThrow(
      /invalid package name/
    )
    expect(adb.pullCalls).toHaveLength(0)
  })
})

describe('backupPackages', () => {
  let adb: FakeAdbClient
  let destDir: string

  beforeEach(async () => {
    adb = new FakeAdbClient()
    destDir = await mkdtemp(join(tmpdir(), 'droid-or-backup-test-'))
  })

  afterEach(async () => {
    await rm(destDir, { recursive: true, force: true })
  })

  it('backs up each package in turn, one bad package not blocking the rest', async () => {
    adb.shellResponses.set(`${SERIAL}\npm path com.good.app`, 'package:/data/app/good/base.apk')
    adb.shellResponses.set(`${SERIAL}\npm path com.missing.app`, '')

    const results = await backupPackages(adb, SERIAL, ['com.good.app', 'com.missing.app'], destDir)

    expect(results.map((r) => [r.packageName, r.success])).toEqual([
      ['com.good.app', true],
      ['com.missing.app', false]
    ])
  })
})
