import { describe, expect, it } from 'vitest'
import { parseAccessibilityServicePackages } from '@main/adb/parsers/accessibility-services-parser'

describe('parseAccessibilityServicePackages', () => {
  it('parses a colon-separated list of ComponentName strings', () => {
    const output =
      'com.google.android.marvin.talkback/.TalkBackService:com.example.launcher/.AutomationService'
    expect(parseAccessibilityServicePackages(output)).toEqual([
      'com.google.android.marvin.talkback',
      'com.example.launcher'
    ])
  })

  it('parses a single enabled service', () => {
    expect(parseAccessibilityServicePackages('com.example.reader/.ReaderService')).toEqual([
      'com.example.reader'
    ])
  })

  it('returns an empty array for the literal string "null"', () => {
    expect(parseAccessibilityServicePackages('null')).toEqual([])
  })

  it('returns an empty array for empty or whitespace-only output', () => {
    expect(parseAccessibilityServicePackages('')).toEqual([])
    expect(parseAccessibilityServicePackages('   \n')).toEqual([])
  })

  it('deduplicates a package that has more than one enabled component', () => {
    const output = 'com.example.app/.ServiceOne:com.example.app/.ServiceTwo'
    expect(parseAccessibilityServicePackages(output)).toEqual(['com.example.app'])
  })

  it('trims surrounding whitespace/newlines from raw adb output', () => {
    expect(parseAccessibilityServicePackages('\ncom.example.app/.Service\n')).toEqual([
      'com.example.app'
    ])
  })
})
