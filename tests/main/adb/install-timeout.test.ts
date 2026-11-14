import { describe, expect, it } from 'vitest'
import { installTimeoutMs } from '@main/adb/adb-client'

const MB = 1024 * 1024

describe('installTimeoutMs', () => {
  it('keeps the 3 minute baseline for small APKs', () => {
    expect(installTimeoutMs(0)).toBe(180_000)
    expect(installTimeoutMs(20 * MB)).toBe(190_000)
  })

  it('scales with size so a 1.5 GB bundle is not cut off at 3 minutes', () => {
    // 1536 MB at an assumed 2 MB/s = 768 s transfer + 180 s baseline.
    expect(installTimeoutMs(1536 * MB)).toBe(948_000)
  })

  it('is capped at one hour', () => {
    expect(installTimeoutMs(100 * 1024 * MB)).toBe(3_600_000)
  })
})
