import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { analyzeDevice } from '@main/android/analyzer.service'
import { runMigrations } from '@main/persistence/migrations'
import { setPackageIgnored } from '@main/persistence/ignored-packages.repository'
import { FakeAdbClient } from '../../fakes/fake-adb-client'

const SERIAL = 'R5CY73MF2QL'

function setUpPackageList(adb: FakeAdbClient): void {
  adb.shellResponses.set(
    `${SERIAL}\npm list packages -f -i -u`,
    [
      // Critical system package (curated as critical) — must be excluded
      // from recommendations but still counted.
      'package:/system/app/SystemUI/SystemUI.apk=com.android.systemui  installer=null',
      // Known safe system bloat.
      'package:/system/app/AREmoji/a.apk=com.samsung.android.aremoji  installer=null',
      // Unreviewed system package — should default to "advanced".
      'package:/system/app/Mystery/m.apk=com.samsung.mystery.service  installer=null',
      // A user-installed app — must not appear in recommendations at all.
      'package:/data/app/com.spotify.music/base.apk=com.spotify.music  installer=com.android.vending'
    ].join('\n')
  )
  adb.shellResponses.set(`${SERIAL}\npm list packages -d -u`, '')
  adb.shellResponses.set(`${SERIAL}\npm list packages -3 -u`, 'package:com.spotify.music')
  adb.shellResponses.set(`${SERIAL}\ndumpsys package packages`, '')
}

describe('analyzeDevice', () => {
  let db: Database.Database
  let adb: FakeAdbClient

  beforeEach(() => {
    db = new Database(':memory:')
    runMigrations(db)
    adb = new FakeAdbClient()
    setUpPackageList(adb)
  })

  afterEach(() => {
    db.close()
  })

  it('only analyzes system packages, excluding user-installed apps entirely', async () => {
    adb.shellResponses.set(`${SERIAL}\ndumpsys activity processes`, '')
    const result = await analyzeDevice(db, adb, SERIAL)

    expect(result.recommendations.some((r) => r.packageName === 'com.spotify.music')).toBe(false)
  })

  it('excludes critical packages from recommendations but still counts them in the summary', async () => {
    adb.shellResponses.set(`${SERIAL}\ndumpsys activity processes`, '')
    const result = await analyzeDevice(db, adb, SERIAL)

    expect(result.recommendations.some((r) => r.packageName === 'com.android.systemui')).toBe(false)
    expect(result.summary.critical).toBe(1)
  })

  it('includes known-safe and unreviewed system packages with correct classification', async () => {
    adb.shellResponses.set(`${SERIAL}\ndumpsys activity processes`, '')
    const result = await analyzeDevice(db, adb, SERIAL)

    const safe = result.recommendations.find((r) => r.packageName === 'com.samsung.android.aremoji')
    expect(safe).toMatchObject({ risk: 'safe', isKnownPackage: true })

    const unreviewed = result.recommendations.find(
      (r) => r.packageName === 'com.samsung.mystery.service'
    )
    expect(unreviewed).toMatchObject({ risk: 'advanced', isKnownPackage: false })

    expect(result.summary).toMatchObject({ safe: 1, advanced: 1, critical: 1 })
  })

  it('flags a package as running when it appears in dumpsys activity processes', async () => {
    adb.shellResponses.set(
      `${SERIAL}\ndumpsys activity processes`,
      'packageList={com.samsung.android.aremoji}'
    )
    const result = await analyzeDevice(db, adb, SERIAL)

    const running = result.recommendations.find(
      (r) => r.packageName === 'com.samsung.android.aremoji'
    )
    expect(running?.isRunning).toBe(true)

    const notRunning = result.recommendations.find(
      (r) => r.packageName === 'com.samsung.mystery.service'
    )
    expect(notRunning?.isRunning).toBe(false)
  })

  it('marks and counts ignored packages without excluding them from the response', async () => {
    setPackageIgnored(db, 'com.samsung.android.aremoji', true)
    adb.shellResponses.set(`${SERIAL}\ndumpsys activity processes`, '')

    const result = await analyzeDevice(db, adb, SERIAL)

    const ignored = result.recommendations.find(
      (r) => r.packageName === 'com.samsung.android.aremoji'
    )
    expect(ignored?.isIgnored).toBe(true)
    expect(result.summary.ignored).toBe(1)
  })

  it('degrades gracefully (empty running set) if the process dump itself fails', async () => {
    // No shellResponse configured for dumpsys activity processes -> rejects.
    const result = await analyzeDevice(db, adb, SERIAL)
    expect(result.recommendations.every((r) => r.isRunning === false)).toBe(true)
  })
})
