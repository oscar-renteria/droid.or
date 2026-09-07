import { describe, expect, it } from 'vitest'
import { isValidPackageName } from '@main/adb/android-package-name'

describe('isValidPackageName', () => {
  it('accepts standard multi-segment package names', () => {
    expect(isValidPackageName('com.google.android.gm')).toBe(true)
    expect(isValidPackageName('com.samsung.knox.securefolder')).toBe(true)
  })

  it('accepts the single-segment "android" package', () => {
    expect(isValidPackageName('android')).toBe(true)
  })

  it('accepts underscores within a segment', () => {
    expect(isValidPackageName('com.apobank_apotanplus.app')).toBe(true)
  })

  it('rejects shell metacharacters and whitespace', () => {
    expect(isValidPackageName('com.evil; rm -rf /')).toBe(false)
    expect(isValidPackageName('com.evil`whoami`')).toBe(false)
    expect(isValidPackageName('com.evil && echo hi')).toBe(false)
    expect(isValidPackageName('com.evil$(whoami)')).toBe(false)
  })

  it('rejects empty string and a lone dot', () => {
    expect(isValidPackageName('')).toBe(false)
    expect(isValidPackageName('.')).toBe(false)
  })

  it('rejects a segment starting with a digit', () => {
    expect(isValidPackageName('com.1invalid.app')).toBe(false)
  })
})
