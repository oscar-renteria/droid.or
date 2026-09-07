import { describe, expect, it } from 'vitest'
import { parsePackageDump } from '@main/adb/parsers/package-dump-parser'

// Trimmed from a real `adb shell dumpsys package packages` capture (595
// packages on a Samsung device) — keeps the two-space section header and the
// mixed 4/6-space field indentation exactly as captured.
const REAL_SAMPLE = `  Package [com.google.android.gm] (c93d7a7):
    appId=10301
    codePath=/product/app/Gmail2
    versionCode=65357932 minSdk=23 targetSdk=35
    versionName=2025.09.22.811856720.Release
    lastUpdateTime=2024-01-01 13:01:45
      firstInstallTime=2024-01-01 13:01:45
  Package [com.example.other] (a1b2c3d):
    versionCode=12 minSdk=21 targetSdk=30
    versionName=1.0.0
    lastUpdateTime=2025-06-01 09:00:00
    firstInstallTime=2025-01-01 09:00:00
`

describe('parsePackageDump', () => {
  it('parses version and install-time fields per package from a real multi-package capture', () => {
    const result = parsePackageDump(REAL_SAMPLE)

    expect(result.get('com.google.android.gm')).toMatchObject({
      versionCode: 65357932,
      versionName: '2025.09.22.811856720.Release'
    })
    expect(result.get('com.example.other')).toMatchObject({
      versionCode: 12,
      versionName: '1.0.0'
    })
  })

  it('does not bleed fields from one package section into the next', () => {
    const result = parsePackageDump(REAL_SAMPLE)
    expect(result.get('com.example.other')?.versionCode).not.toBe(65357932)
  })

  it('returns an empty map for output with no package sections', () => {
    expect(parsePackageDump('nothing here').size).toBe(0)
  })

  it('returns nulls for a package section missing expected fields', () => {
    const result = parsePackageDump('  Package [com.minimal] (deadbee):\n    appId=1\n')
    expect(result.get('com.minimal')).toEqual({
      versionCode: null,
      versionName: null,
      firstInstallTimeMs: null,
      lastUpdateTimeMs: null
    })
  })
})
