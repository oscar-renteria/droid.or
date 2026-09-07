import { describe, expect, it } from 'vitest'
import { getBootloaderState } from '@main/adb/bootloader-state'

describe('getBootloaderState', () => {
  it('maps "green" to locked (verified against a real device)', () => {
    expect(getBootloaderState('green')).toBe('locked')
  })

  it('maps "orange" to unlocked', () => {
    expect(getBootloaderState('orange')).toBe('unlocked')
  })

  it('maps "yellow" to unlocked-custom-key', () => {
    expect(getBootloaderState('yellow')).toBe('unlocked-custom-key')
  })

  it('maps "red" to verification-failed', () => {
    expect(getBootloaderState('red')).toBe('verification-failed')
  })

  it('maps missing/unrecognized values to unknown rather than guessing', () => {
    expect(getBootloaderState(undefined)).toBe('unknown')
    expect(getBootloaderState('')).toBe('unknown')
    expect(getBootloaderState('some-future-value')).toBe('unknown')
  })
})
