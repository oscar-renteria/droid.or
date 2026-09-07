import { describe, expect, it } from 'vitest'
import { parseMeminfo } from '@main/adb/parsers/meminfo-parser'

// Real `adb shell cat /proc/meminfo` capture (Samsung Galaxy Z Flip).
const REAL_SAMPLE = `MemTotal:       11481680 kB
MemFree:          641552 kB
MemAvailable:    4133952 kB
Buffers:            2648 kB
Cached:          3356604 kB
SwapTotal:       8388604 kB
SwapFree:        6291452 kB`

describe('parseMeminfo', () => {
  it('parses MemTotal and MemAvailable from the real capture', () => {
    expect(parseMeminfo(REAL_SAMPLE)).toEqual({ totalKb: 11481680, availableKb: 4133952 })
  })

  it('prefers MemAvailable over MemFree, and returns null for a missing field', () => {
    const result = parseMeminfo('MemTotal: 1000 kB\nMemFree: 100 kB')
    expect(result).toEqual({ totalKb: 1000, availableKb: null })
  })

  it('returns nulls for unrecognized input', () => {
    expect(parseMeminfo('')).toEqual({ totalKb: null, availableKb: null })
  })
})
