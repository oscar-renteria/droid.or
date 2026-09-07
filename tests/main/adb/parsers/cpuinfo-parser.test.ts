import { describe, expect, it } from 'vitest'
import { parseCpuCoreCount } from '@main/adb/parsers/cpuinfo-parser'

describe('parseCpuCoreCount', () => {
  it('counts processor lines, matching a real /proc/cpuinfo capture (10 cores)', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `processor\t: ${i}`)
    expect(parseCpuCoreCount(lines.join('\n'))).toBe(10)
  })

  it('returns null when there are no processor lines', () => {
    expect(parseCpuCoreCount('')).toBeNull()
  })
})
