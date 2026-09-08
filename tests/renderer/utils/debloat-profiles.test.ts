import type { PackageRecommendation } from '@shared/types/analyzer'
import { describe, expect, it } from 'vitest'
import {
  DEBLOAT_PROFILES,
  getProfileCandidates,
  getProfileCounts
} from '@renderer/utils/debloat-profiles'

function recommendation(overrides: Partial<PackageRecommendation> = {}): PackageRecommendation {
  return {
    packageName: 'com.example.app',
    displayName: null,
    isSystemApp: true,
    isDisabled: false,
    isRunning: false,
    risk: 'safe',
    reason: 'test',
    potentialImpact: 'test',
    isKnownPackage: true,
    isIgnored: false,
    ...overrides
  }
}

const minimal = DEBLOAT_PROFILES.find((p) => p.id === 'minimal')!
const recommended = DEBLOAT_PROFILES.find((p) => p.id === 'recommended')!
const aggressive = DEBLOAT_PROFILES.find((p) => p.id === 'aggressive')!

describe('DEBLOAT_PROFILES', () => {
  it('defines exactly minimal, recommended, and aggressive', () => {
    expect(DEBLOAT_PROFILES.map((p) => p.id)).toEqual(['minimal', 'recommended', 'aggressive'])
  })

  it('never includes critical or advanced risk tiers in any profile', () => {
    for (const profile of DEBLOAT_PROFILES) {
      expect(profile.riskTiers).not.toContain('critical')
      expect(profile.riskTiers).not.toContain('advanced')
    }
  })
})

describe('getProfileCandidates', () => {
  it('minimal only includes safe-risk packages', () => {
    const recs = [
      recommendation({ packageName: 'a', risk: 'safe' }),
      recommendation({ packageName: 'b', risk: 'caution' })
    ]
    expect(getProfileCandidates(minimal, recs).map((r) => r.packageName)).toEqual(['a'])
  })

  it('recommended includes safe and caution', () => {
    const recs = [
      recommendation({ packageName: 'a', risk: 'safe' }),
      recommendation({ packageName: 'b', risk: 'caution' }),
      recommendation({ packageName: 'c', risk: 'advanced' })
    ]
    expect(getProfileCandidates(recommended, recs).map((r) => r.packageName)).toEqual(['a', 'b'])
  })

  it('excludes ignored packages regardless of profile', () => {
    const recs = [recommendation({ packageName: 'a', risk: 'safe', isIgnored: true })]
    expect(getProfileCandidates(minimal, recs)).toEqual([])
  })

  it('excludes already-disabled packages for a disable-operation profile', () => {
    const recs = [recommendation({ packageName: 'a', risk: 'safe', isDisabled: true })]
    expect(getProfileCandidates(minimal, recs)).toEqual([])
  })

  it('still includes an already-disabled package for an uninstall-operation profile', () => {
    const recs = [recommendation({ packageName: 'a', risk: 'safe', isDisabled: true })]
    expect(getProfileCandidates(aggressive, recs).map((r) => r.packageName)).toEqual(['a'])
  })
})

describe('getProfileCounts', () => {
  it('splits candidates into safe/caution buckets and a total', () => {
    const recs = [
      recommendation({ packageName: 'a', risk: 'safe' }),
      recommendation({ packageName: 'b', risk: 'safe' }),
      recommendation({ packageName: 'c', risk: 'caution' })
    ]
    expect(getProfileCounts(recommended, recs)).toEqual({ safe: 2, caution: 1, total: 3 })
  })

  it('is all zero when nothing matches', () => {
    expect(getProfileCounts(minimal, [])).toEqual({ safe: 0, caution: 0, total: 0 })
  })
})
