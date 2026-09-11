import { describe, expect, it } from 'vitest'
import {
  classifySplitAttribute,
  classifySplitFileName,
  mapDpiToDensityBucket,
  orderSplitInstallParts
} from '@main/android/split-apk-classifier'

describe('mapDpiToDensityBucket', () => {
  it.each([
    [120, 'ldpi'],
    [160, 'mdpi'],
    [213, 'tvdpi'],
    [240, 'hdpi'],
    [320, 'xhdpi'],
    [480, 'xxhdpi'],
    [640, 'xxxhdpi']
  ])('maps the exact reference value %i dpi to %s', (dpi, expected) => {
    expect(mapDpiToDensityBucket(dpi)).toBe(expected)
  })

  it('maps a real-world value that is not an exact reference point to the nearest bucket', () => {
    // A common real device density (e.g. many 1080p phones report ~420-440
    // rather than the exact 480 xxhdpi reference point).
    expect(mapDpiToDensityBucket(420)).toBe('xxhdpi')
    expect(mapDpiToDensityBucket(300)).toBe('xhdpi')
  })
})

describe('classifySplitAttribute', () => {
  it('returns null for a base APK (no split attribute)', () => {
    expect(classifySplitAttribute(null)).toBeNull()
    expect(classifySplitAttribute(undefined)).toBeNull()
  })

  it.each([
    ['config.arm64_v8a', 'arm64-v8a'],
    ['config.armeabi_v7a', 'armeabi-v7a'],
    ['config.x86_64', 'x86_64']
  ])('classifies %s as an ABI split (%s)', (attribute, expectedAbi) => {
    expect(classifySplitAttribute(attribute)).toEqual({
      role: 'abi',
      abi: expectedAbi,
      density: null,
      language: null
    })
  })

  it('classifies a density qualifier', () => {
    expect(classifySplitAttribute('config.xxhdpi')).toEqual({
      role: 'density',
      abi: null,
      density: 'xxhdpi',
      language: null
    })
  })

  it('classifies a language qualifier', () => {
    expect(classifySplitAttribute('config.en')).toEqual({
      role: 'language',
      abi: null,
      density: null,
      language: 'en'
    })
  })

  it('returns null for a named dynamic feature module split (not a "config." value)', () => {
    expect(classifySplitAttribute('ads')).toBeNull()
  })

  it('is case-insensitive about the "config." prefix', () => {
    expect(classifySplitAttribute('CONFIG.arm64_v8a')).toEqual({
      role: 'abi',
      abi: 'arm64-v8a',
      density: null,
      language: null
    })
  })
})

describe('classifySplitFileName', () => {
  it('recognizes "base.apk" as the base', () => {
    expect(classifySplitFileName('base.apk')).toEqual({
      role: 'base',
      abi: null,
      density: null,
      language: null
    })
  })

  it('recognizes "standalone.apk" as the base', () => {
    expect(classifySplitFileName('standalone.apk')).toMatchObject({ role: 'base' })
  })

  it.each([
    ['split_config.arm64_v8a.apk', 'arm64-v8a'],
    ['split_config.armeabi_v7a.apk', 'armeabi-v7a'],
    ['config.x86_64.apk', 'x86_64'],
    ['config.x86.apk', 'x86'],
    ['config.armeabi.apk', 'armeabi']
  ])('recognizes %s as an ABI split (%s)', (fileName, expectedAbi) => {
    expect(classifySplitFileName(fileName)).toEqual({
      role: 'abi',
      abi: expectedAbi,
      density: null,
      language: null
    })
  })

  it.each(['ldpi', 'mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi', 'tvdpi', 'nodpi'])(
    'recognizes config.%s.apk as a density split',
    (density) => {
      expect(classifySplitFileName(`split_config.${density}.apk`)).toEqual({
        role: 'density',
        abi: null,
        density,
        language: null
      })
    }
  )

  it('recognizes a two-letter language qualifier', () => {
    expect(classifySplitFileName('config.en.apk')).toEqual({
      role: 'language',
      abi: null,
      density: null,
      language: 'en'
    })
  })

  it('recognizes a region-qualified language tag', () => {
    expect(classifySplitFileName('split_config.zh_hans.apk')).toEqual({
      role: 'language',
      abi: null,
      density: null,
      language: 'zh-hans'
    })
  })

  it('classifies an unrecognized file name as unknown rather than guessing', () => {
    expect(classifySplitFileName('myFeatureModule.apk')).toEqual({
      role: 'unknown',
      abi: null,
      density: null,
      language: null
    })
  })

  it('is case-insensitive', () => {
    expect(classifySplitFileName('BASE.APK')).toMatchObject({ role: 'base' })
    expect(classifySplitFileName('Split_Config.ARM64_V8A.apk')).toEqual({
      role: 'abi',
      abi: 'arm64-v8a',
      density: null,
      language: null
    })
  })
})

describe('orderSplitInstallParts', () => {
  it('orders base, then abi, then density, then language, then unknown', () => {
    const parts = [
      { role: 'language' as const, fileName: 'config.en.apk' },
      { role: 'unknown' as const, fileName: 'weird.apk' },
      { role: 'density' as const, fileName: 'config.xxhdpi.apk' },
      { role: 'base' as const, fileName: 'base.apk' },
      { role: 'abi' as const, fileName: 'config.arm64_v8a.apk' }
    ]

    expect(orderSplitInstallParts(parts).map((part) => part.fileName)).toEqual([
      'base.apk',
      'config.arm64_v8a.apk',
      'config.xxhdpi.apk',
      'config.en.apk',
      'weird.apk'
    ])
  })

  it('breaks ties within the same role alphabetically, for deterministic output', () => {
    const parts = [
      { role: 'abi' as const, fileName: 'config.x86_64.apk' },
      { role: 'abi' as const, fileName: 'config.arm64_v8a.apk' }
    ]

    expect(orderSplitInstallParts(parts).map((part) => part.fileName)).toEqual([
      'config.arm64_v8a.apk',
      'config.x86_64.apk'
    ])
  })

  it('does not mutate the input array', () => {
    const parts = [
      { role: 'unknown' as const, fileName: 'b.apk' },
      { role: 'base' as const, fileName: 'a.apk' }
    ]
    const original = [...parts]

    orderSplitInstallParts(parts)

    expect(parts).toEqual(original)
  })
})
