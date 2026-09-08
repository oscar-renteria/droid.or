import type Database from 'better-sqlite3'
import type { AnalyzeDeviceResult, PackageRecommendation } from '@shared/validation/analyzer.schema'
import type { AdbClient } from '../adb/adb-client'
import { parseRunningPackages } from '../adb/parsers/running-packages-parser'
import { getFavoritePackages } from '../persistence/favorite-packages.repository'
import { getIgnoredPackages } from '../persistence/ignored-packages.repository'
import { fetchInstalledPackages } from './package.service'
import { classifyPackage } from './risk-classifier'

/**
 * Analyzes a device's installed packages for debloat opportunities.
 * Deliberately considers system packages only — a user-installed app was
 * something the person chose to put on their device themselves, so there
 * is nothing to "recommend" about it the way there is for preinstalled
 * OEM/carrier bloat; it stays fully visible and manageable from the Apps
 * tab, just outside this analysis.
 */
export async function analyzeDevice(
  db: Database.Database,
  adbClient: AdbClient,
  serial: string
): Promise<AnalyzeDeviceResult> {
  const [packages, runningOutput] = await Promise.all([
    fetchInstalledPackages(adbClient, serial, getFavoritePackages(db)),
    adbClient.shellCommand(serial, ['dumpsys', 'activity', 'processes']).catch(() => '')
  ])

  const runningPackages = parseRunningPackages(runningOutput)
  const ignoredPackages = getIgnoredPackages(db)

  const summary = { safe: 0, caution: 0, advanced: 0, critical: 0, ignored: 0 }
  const recommendations: PackageRecommendation[] = []

  for (const pkg of packages) {
    if (!pkg.isSystemApp) {
      continue
    }

    const classification = classifyPackage(pkg.packageName)
    summary[classification.risk] += 1

    const isIgnored = ignoredPackages.has(pkg.packageName)
    if (isIgnored) {
      summary.ignored += 1
    }

    if (classification.risk === 'critical') {
      continue
    }

    recommendations.push({
      packageName: pkg.packageName,
      displayName: pkg.displayName,
      isSystemApp: pkg.isSystemApp,
      isDisabled: pkg.isDisabled,
      isRunning: runningPackages.has(pkg.packageName),
      risk: classification.risk,
      reason: classification.reason,
      potentialImpact: classification.potentialImpact,
      isKnownPackage: classification.isKnownPackage,
      isIgnored,
      isFavorite: pkg.isFavorite
    })
  }

  return {
    deviceId: serial,
    analyzedAt: new Date().toISOString(),
    summary,
    recommendations
  }
}
