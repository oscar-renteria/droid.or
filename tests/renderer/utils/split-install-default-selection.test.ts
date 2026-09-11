import type { SplitApkPart, SplitInstallAnalysis } from '@shared/types/split-install'
import { describe, expect, it } from 'vitest'
import { computeDefaultSelectedFileNames } from '@renderer/utils/split-install-default-selection'

function part(
  overrides: Partial<SplitApkPart> & Pick<SplitApkPart, 'fileName' | 'role'>
): SplitApkPart {
  return {
    filePath: `/tmp/${overrides.fileName}`,
    fileSizeBytes: 1024,
    abi: null,
    density: null,
    language: null,
    rawSplitAttribute: null,
    packageName: 'com.example.app',
    versionName: null,
    versionCode: 1,
    minSdkVersion: null,
    targetSdkVersion: null,
    label: null,
    iconDataUrl: null,
    deviceCompatible: true,
    ...overrides
  }
}

function analysis(overrides: Partial<SplitInstallAnalysis> = {}): SplitInstallAnalysis {
  return {
    sourceKind: 'files',
    sourcePaths: ['/tmp/base.apk'],
    packageName: 'com.example.app',
    versionName: '1.0.0',
    versionCode: 1,
    label: 'Example App',
    iconDataUrl: null,
    devicePrimaryAbi: null,
    deviceDensityBucket: null,
    parts: [],
    issues: [],
    canInstall: true,
    plan: null,
    ...overrides
  }
}

describe('computeDefaultSelectedFileNames', () => {
  it('never selects the base part', () => {
    const result = computeDefaultSelectedFileNames(
      analysis({ parts: [part({ fileName: 'base.apk', role: 'base' })] })
    )
    expect(result.has('base.apk')).toBe(false)
  })

  it('never selects a device-incompatible part', () => {
    const result = computeDefaultSelectedFileNames(
      analysis({
        parts: [
          part({ fileName: 'base.apk', role: 'base' }),
          part({ fileName: 'x86.apk', role: 'abi', abi: 'x86', deviceCompatible: false })
        ]
      })
    )
    expect(result.size).toBe(0)
  })

  it('selects only the device primary ABI split when multiple compatible ABI splits exist', () => {
    // Realistic case: a 64-bit device's abilist also includes the 32-bit
    // ABI, so both splits are individually "compatible" — only the
    // primary one should be pre-checked.
    const result = computeDefaultSelectedFileNames(
      analysis({
        devicePrimaryAbi: 'arm64-v8a',
        parts: [
          part({ fileName: 'base.apk', role: 'base' }),
          part({ fileName: 'arm64.apk', role: 'abi', abi: 'arm64-v8a' }),
          part({ fileName: 'armeabi.apk', role: 'abi', abi: 'armeabi-v7a' })
        ]
      })
    )
    expect(result).toEqual(new Set(['arm64.apk']))
  })

  it('falls back to selecting every compatible ABI split when the primary ABI matches none of them', () => {
    const result = computeDefaultSelectedFileNames(
      analysis({
        devicePrimaryAbi: 'arm64-v8a',
        parts: [
          part({ fileName: 'base.apk', role: 'base' }),
          part({ fileName: 'armeabi.apk', role: 'abi', abi: 'armeabi-v7a' })
        ]
      })
    )
    expect(result).toEqual(new Set(['armeabi.apk']))
  })

  it('falls back to selecting every compatible ABI split when the device primary ABI is unknown', () => {
    const result = computeDefaultSelectedFileNames(
      analysis({
        devicePrimaryAbi: null,
        parts: [
          part({ fileName: 'base.apk', role: 'base' }),
          part({ fileName: 'arm64.apk', role: 'abi', abi: 'arm64-v8a' }),
          part({ fileName: 'armeabi.apk', role: 'abi', abi: 'armeabi-v7a' })
        ]
      })
    )
    expect(result).toEqual(new Set(['arm64.apk', 'armeabi.apk']))
  })

  it('selects only the device density bucket when multiple compatible density splits exist', () => {
    const result = computeDefaultSelectedFileNames(
      analysis({
        deviceDensityBucket: 'xxhdpi',
        parts: [
          part({ fileName: 'base.apk', role: 'base' }),
          part({ fileName: 'hdpi.apk', role: 'density', density: 'hdpi' }),
          part({ fileName: 'xxhdpi.apk', role: 'density', density: 'xxhdpi' }),
          part({ fileName: 'xxxhdpi.apk', role: 'density', density: 'xxxhdpi' })
        ]
      })
    )
    expect(result).toEqual(new Set(['xxhdpi.apk']))
  })

  it('falls back to selecting every compatible density split when the bucket is unknown', () => {
    const result = computeDefaultSelectedFileNames(
      analysis({
        deviceDensityBucket: null,
        parts: [
          part({ fileName: 'base.apk', role: 'base' }),
          part({ fileName: 'hdpi.apk', role: 'density', density: 'hdpi' }),
          part({ fileName: 'xxhdpi.apk', role: 'density', density: 'xxhdpi' })
        ]
      })
    )
    expect(result).toEqual(new Set(['hdpi.apk', 'xxhdpi.apk']))
  })

  it('always selects every compatible language and unknown part', () => {
    const result = computeDefaultSelectedFileNames(
      analysis({
        parts: [
          part({ fileName: 'base.apk', role: 'base' }),
          part({ fileName: 'en.apk', role: 'language', language: 'en' }),
          part({ fileName: 'fr.apk', role: 'language', language: 'fr' }),
          part({ fileName: 'feature.apk', role: 'unknown', rawSplitAttribute: 'ads' })
        ]
      })
    )
    expect(result).toEqual(new Set(['en.apk', 'fr.apk', 'feature.apk']))
  })
})
