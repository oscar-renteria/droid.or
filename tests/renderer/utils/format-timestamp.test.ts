import { describe, expect, it } from 'vitest'
import { formatTimestamp } from '@renderer/utils/format-timestamp'

describe('formatTimestamp', () => {
  it('returns a locale string for an ISO timestamp', () => {
    const result = formatTimestamp('2024-01-15T09:30:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('matches the platform locale formatting of the same instant', () => {
    const input = '2024-06-01T12:00:00.000Z'
    expect(formatTimestamp(input)).toBe(new Date(input).toLocaleString())
  })
})
