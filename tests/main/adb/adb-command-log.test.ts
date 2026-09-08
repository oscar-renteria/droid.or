import { describe, expect, it } from 'vitest'
import { AdbCommandLog } from '@main/adb/adb-command-log'

describe('AdbCommandLog', () => {
  it('returns entries newest first', () => {
    const log = new AdbCommandLog()
    log.record({
      deviceId: 'S1',
      category: 'shell',
      command: 'first',
      durationMs: 5,
      success: true,
      errorMessage: null
    })
    log.record({
      deviceId: 'S1',
      category: 'shell',
      command: 'second',
      durationMs: 5,
      success: true,
      errorMessage: null
    })

    const entries = log.getAll()
    expect(entries.map((e) => e.command)).toEqual(['second', 'first'])
    expect(entries[0]?.id).toBeGreaterThan(entries[1]?.id ?? 0)
  })

  it('caps the buffer and drops the oldest entries first', () => {
    const log = new AdbCommandLog()
    for (let i = 0; i < 505; i += 1) {
      log.record({
        deviceId: null,
        category: 'shell',
        command: `cmd-${i}`,
        durationMs: 1,
        success: true,
        errorMessage: null
      })
    }

    const entries = log.getAll()
    expect(entries).toHaveLength(500)
    expect(entries[0]?.command).toBe('cmd-504')
    expect(entries[entries.length - 1]?.command).toBe('cmd-5')
  })

  it('clear empties the buffer', () => {
    const log = new AdbCommandLog()
    log.record({
      deviceId: null,
      category: 'shell',
      command: 'cmd',
      durationMs: 1,
      success: true,
      errorMessage: null
    })
    log.clear()
    expect(log.getAll()).toEqual([])
  })
})
