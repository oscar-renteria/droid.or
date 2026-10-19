import { describe, expect, it } from 'vitest'
import { formatBytes } from '@renderer/utils/format-bytes'

describe('formatBytes', () => {
  it('formats bytes under 1 KiB as bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('formats in KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats in MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(3 * 1024 * 1024 + 512 * 1024)).toBe('3.5 MB')
  })

  it('caps at GB', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB')
  })
})