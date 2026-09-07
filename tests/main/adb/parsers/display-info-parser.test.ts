import { describe, expect, it } from 'vitest'
import {
  parseActiveRefreshRateHz,
  parseWmDensity,
  parseWmSize
} from '@main/adb/parsers/display-info-parser'

describe('parseWmSize', () => {
  it('parses a real `wm size` capture with no override', () => {
    expect(parseWmSize('Physical size: 1080x2520')).toBe('1080x2520')
  })

  it('prefers an override size when present', () => {
    expect(parseWmSize('Physical size: 1080x2520\nOverride size: 720x1680')).toBe('720x1680')
  })

  it('returns null for unrecognized output', () => {
    expect(parseWmSize('')).toBeNull()
  })
})

describe('parseWmDensity', () => {
  it('prefers override density, verified against a real capture where both are present', () => {
    // Real `adb shell wm density` capture: the device had an active
    // override (420) distinct from its physical density (480).
    expect(parseWmDensity('Physical density: 480\nOverride density: 420')).toBe(420)
  })

  it('falls back to physical density when there is no override', () => {
    expect(parseWmDensity('Physical density: 480')).toBe(480)
  })

  it('returns null for unrecognized output', () => {
    expect(parseWmDensity('')).toBeNull()
  })
})

describe('parseActiveRefreshRateHz', () => {
  it('extracts renderFrameRate from a real DisplayDeviceInfo block', () => {
    // Trimmed from a real `adb shell dumpsys display` capture. Verified
    // that this device's dump also contains an unrelated, non-corresponding
    // "DisplayMode{id=5, ..., peakRefreshRate=24.0}" entry using the same id
    // under a completely different numbering scheme — renderFrameRate must
    // be read directly rather than resolved by cross-referencing modeId.
    const output =
      'DisplayDeviceInfo{"Built-in Screen": uniqueId="local:123", 1080 x 2520, modeId 5, renderFrameRate 30.0, hasArrSupport false, ...}\n' +
      'DisplayMode{id=5, width=1080, height=2520, peakRefreshRate=24.0, vsyncRate=24.0}'

    expect(parseActiveRefreshRateHz(output)).toBe(30)
  })

  it('returns null when the field is absent (e.g. an older Android version)', () => {
    expect(parseActiveRefreshRateHz('DisplayDeviceInfo{"Built-in Screen": modeId 1}')).toBeNull()
  })
})
