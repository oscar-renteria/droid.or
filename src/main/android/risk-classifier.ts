import type { RiskLevel } from '@shared/validation/analyzer.schema'
import { PACKAGE_RISK_DATABASE } from './package-risk-database'

export interface RiskClassification {
  risk: RiskLevel
  reason: string
  potentialImpact: string
  isKnownPackage: boolean
}

/**
 * Exact package names that are unambiguously core AOSP components on
 * essentially every Android device, checked even when a package isn't in
 * the curated database — a safety net so an unreviewed core component is
 * never classified down to "advanced" by the generic fallback below.
 * Deliberately short and exact-match only (no prefix/substring matching):
 * spec explicitly warns against rules like "everything containing
 * 'android' is critical", which would misclassify ordinary third-party
 * and OEM packages that happen to share a namespace.
 */
const CRITICAL_SAFETY_NET: ReadonlySet<string> = new Set([
  'com.android.providers.contacts',
  'com.android.providers.downloads',
  'com.android.providers.telephony',
  'com.android.server.telecom',
  'com.android.launcher3',
  'com.android.location.fused'
])

/**
 * Classifies one system package. Never invents a specific reason for a
 * package it doesn't actually know: an unrecognized package defaults to
 * "advanced" (a real-but-unclear risk of side effects), not "safe" — the
 * mirror-image mistake of "everything containing Samsung is bloat" would
 * be quietly recommending removal of something nobody has actually
 * reviewed just because it happens to be unfamiliar.
 */
export function classifyPackage(packageName: string): RiskClassification {
  const known = PACKAGE_RISK_DATABASE.get(packageName)
  if (known) {
    return { ...known, isKnownPackage: true }
  }

  if (CRITICAL_SAFETY_NET.has(packageName)) {
    return {
      risk: 'critical',
      reason: 'A core Android system component.',
      potentialImpact:
        'Removing or disabling this is very likely to break core device functionality.',
      isKnownPackage: false
    }
  }

  return {
    risk: 'advanced',
    reason: 'A preinstalled system package not yet reviewed in the local knowledge base.',
    potentialImpact:
      'Unknown — this package has not been evaluated, so any effect of removing it is unclear.',
    isKnownPackage: false
  }
}
