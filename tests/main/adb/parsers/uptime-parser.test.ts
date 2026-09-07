import { describe, expect, it } from 'vitest'
import { parseUptimeSeconds } from '@main/adb/parsers/uptime-parser'

describe('parseUptimeSeconds', () => {
  it('parses the first value from a real /proc/uptime capture', () => {
    expect(parseUptimeSeconds('1121348.54 4655703.72')).toBeCloseTo(1121348.54)
  })

  it('returns null for empty input', () => {
    expect(parseUptimeSeconds('')).toBeNull()
  })
})
