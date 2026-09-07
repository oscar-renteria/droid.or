import { describe, expect, it } from 'vitest'
import { parseRunningPackages } from '@main/adb/parsers/running-packages-parser'

describe('parseRunningPackages', () => {
  it('extracts package names from real dumpsys activity processes output', () => {
    // Trimmed from a real capture: a process record's packageList={...} line.
    const output = `
  *APP* UID 10382 ProcessRecord{6f009f3 10830:com.whatsapp.w4b/u0a382}
    packageList={com.whatsapp.w4b}
    pid=10830
  *APP* UID 10050 ProcessRecord{abc 1234:com.android.systemui/u0a50}
    packageList={com.android.systemui}
    pid=1234
`
    const result = parseRunningPackages(output)
    expect(result.has('com.whatsapp.w4b')).toBe(true)
    expect(result.has('com.android.systemui')).toBe(true)
    expect(result.size).toBe(2)
  })

  it('handles a process hosting multiple packages under a shared UID', () => {
    const output = 'packageList={com.a, com.b,com.c}'
    const result = parseRunningPackages(output)
    expect(result).toEqual(new Set(['com.a', 'com.b', 'com.c']))
  })

  it('returns an empty set for output with no processes', () => {
    expect(parseRunningPackages('').size).toBe(0)
  })
})
