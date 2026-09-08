import type { PackageRecommendation, RiskLevel } from '@shared/types/analyzer'
import type { MutatingOperationType } from '@shared/types/operation'

export interface DebloatProfile {
  id: string
  name: string
  description: string
  /** A package is a candidate for this profile only if its risk tier is in
   *  this list — critical-risk packages can never appear here at all,
   *  since the analyzer itself never includes them in `recommendations`
   *  in the first place. */
  riskTiers: RiskLevel[]
  operation: MutatingOperationType
}

/**
 * Deliberately just three profiles, not the spec's full example list
 * (which also names per-manufacturer and per-use-case profiles like
 * "Samsung Cleanup", "Gaming", "Battery Optimization"). This app's curated
 * package database (package-risk-database.ts) only has enough
 * independently-reasoned entries to honestly support a risk-tier-based
 * split — inventing a "Xiaomi Cleanup" list with no verified data behind
 * it would be exactly the kind of fabricated capability the project
 * brief prohibits. These three differ in real, meaningful ways without
 * requiring any package list beyond what's already reviewed: which risk
 * tiers are included, and how strong the resulting action is.
 */
export const DEBLOAT_PROFILES: DebloatProfile[] = [
  {
    id: 'minimal',
    name: 'Minimal Debloat',
    description:
      'Disables only the safest, most well-documented bloat — no real functional trade-off for most users.',
    riskTiers: ['safe'],
    operation: 'disable'
  },
  {
    id: 'recommended',
    name: 'Recommended Debloat',
    description:
      'Disables safe packages plus legitimate manufacturer/Google features some people rely on (caution tier) — review each one before applying.',
    riskTiers: ['safe', 'caution'],
    operation: 'disable'
  },
  {
    id: 'aggressive',
    name: 'Aggressive Debloat',
    description:
      'Uninstalls (for this user only, not the device) the same safe and caution-tier packages instead of just disabling them — a stronger, harder-to-reverse action on the same reviewed set.',
    riskTiers: ['safe', 'caution'],
    operation: 'uninstall-for-user'
  }
]

/** Packages this profile would act on right now — already excludes
 *  ignored packages and anything already in the profile's target state,
 *  so re-running a profile after applying it (or after the user changed
 *  something manually) never re-offers work that's already done. */
export function getProfileCandidates(
  profile: DebloatProfile,
  recommendations: PackageRecommendation[]
): PackageRecommendation[] {
  return recommendations.filter((recommendation) => {
    if (recommendation.isIgnored) {
      return false
    }
    if (!profile.riskTiers.includes(recommendation.risk)) {
      return false
    }
    if (profile.operation === 'disable' && recommendation.isDisabled) {
      return false
    }
    return true
  })
}

export interface ProfileCounts {
  safe: number
  caution: number
  total: number
}

export function getProfileCounts(
  profile: DebloatProfile,
  recommendations: PackageRecommendation[]
): ProfileCounts {
  const candidates = getProfileCandidates(profile, recommendations)
  return {
    safe: candidates.filter((candidate) => candidate.risk === 'safe').length,
    caution: candidates.filter((candidate) => candidate.risk === 'caution').length,
    total: candidates.length
  }
}
