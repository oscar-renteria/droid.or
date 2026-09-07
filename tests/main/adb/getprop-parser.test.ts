import { describe, expect, it } from 'vitest'
import { parseGetprop } from '@main/adb/getprop-parser'

describe('parseGetprop', () => {
  it('parses standard [key]: [value] lines', () => {
    const output = [
      '[ro.product.manufacturer]: [samsung]',
      '[ro.product.model]: [SM-S911B]',
      '[ro.build.version.release]: [15]',
      '[ro.build.version.sdk]: [35]'
    ].join('\n')

    const result = parseGetprop(output)
    expect(result.get('ro.product.manufacturer')).toBe('samsung')
    expect(result.get('ro.product.model')).toBe('SM-S911B')
    expect(result.get('ro.build.version.release')).toBe('15')
    expect(result.get('ro.build.version.sdk')).toBe('35')
  })

  it('handles an empty bracketed value', () => {
    const result = parseGetprop('[ro.some.prop]: []')
    expect(result.get('ro.some.prop')).toBe('')
  })

  it('ignores lines that do not match the format', () => {
    const result = parseGetprop('not a getprop line\n[valid.key]: [value]')
    expect(result.size).toBe(1)
    expect(result.get('valid.key')).toBe('value')
  })

  it('returns an empty map for empty input', () => {
    expect(parseGetprop('').size).toBe(0)
  })
})
