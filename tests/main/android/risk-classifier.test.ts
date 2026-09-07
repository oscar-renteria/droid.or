import { describe, expect, it } from 'vitest'
import { classifyPackage } from '@main/android/risk-classifier'

describe('classifyPackage', () => {
  it('uses the curated database for a known package, matching the spec example exactly', () => {
    const result = classifyPackage('com.samsung.android.aremoji')
    expect(result.risk).toBe('safe')
    expect(result.isKnownPackage).toBe(true)
    expect(result.reason.length).toBeGreaterThan(0)
    expect(result.potentialImpact.length).toBeGreaterThan(0)
  })

  it('classifies a core AOSP component from the curated database as critical', () => {
    expect(classifyPackage('com.android.systemui').risk).toBe('critical')
    expect(classifyPackage('android').risk).toBe('critical')
  })

  it('falls back to the critical safety net for an unreviewed but unambiguous core component', () => {
    const result = classifyPackage('com.android.providers.contacts')
    expect(result.risk).toBe('critical')
    expect(result.isKnownPackage).toBe(false)
  })

  it('defaults an unknown package to "advanced", never "safe" — no guessing', () => {
    const result = classifyPackage('com.totally.unfamiliar.oem.service')
    expect(result.risk).toBe('advanced')
    expect(result.isKnownPackage).toBe(false)
  })

  it('does not misclassify an ordinary package merely for containing "android" or a manufacturer name', () => {
    // Regression guard against exactly the mistake the spec warns about:
    // pattern-matching on substrings like "samsung" or "android".
    expect(classifyPackage('com.samsung.android.messaging').risk).not.toBe('critical')
    expect(classifyPackage('org.mysteryandroidapp.thing').risk).not.toBe('critical')
  })
})
