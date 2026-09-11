import type Database from 'better-sqlite3'
import type {
  SplitApkPart,
  SplitInstallAnalysis,
  SplitInstallIssue,
  SplitSourceKind
} from '@shared/validation/split-install.schema'
import type { OperationResult } from '@shared/validation/operation.schema'
import type { AdbClient } from '../adb/adb-client'
import { isValidPackageName } from '../adb/android-package-name'
import { formatInstallFailureMessage } from '../adb/android-install-error-codes'
import { extractInstallFailureMessage, isInstallSuccessful } from '../adb/install-result-parser'
import { parseWmDensity } from '../adb/parsers/display-info-parser'
import { recordOperation } from '../persistence/operation-history.repository'
import {
  describeInstallSuccess,
  getInstallPlan,
  getInstalledVersionCode
} from './apk-install.service'
import {
  classifySplitAttribute,
  classifySplitFileName,
  mapDpiToDensityBucket,
  orderSplitInstallParts,
  type SplitFileNameClassification
} from './split-apk-classifier'
import {
  cleanupSplitSource,
  resolveSplitSource,
  type ParseApkFn,
  type RawSplitPart
} from './split-apk-inspector'

function resolveDeviceAbiList(properties: Map<string, string>): string[] {
  const abilist = properties.get('ro.product.cpu.abilist')
  if (abilist) {
    return abilist
      .split(',')
      .map((abi) => abi.trim())
      .filter((abi) => abi.length > 0)
  }
  return [properties.get('ro.product.cpu.abi'), properties.get('ro.product.cpu.abi2')].filter(
    (abi): abi is string => Boolean(abi)
  )
}

function resolveDeviceSdkVersion(properties: Map<string, string>): number | null {
  const raw = properties.get('ro.build.version.sdk')
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

/** Reads the device's current screen density via the same `wm density`
 *  command the device dashboard already uses (see
 *  device-dashboard.service.ts), reusing its existing parser rather than
 *  introducing a second one. Degrades to null on any failure — this only
 *  ever affects a UI pre-selection default, never a validation gate. */
async function resolveDeviceDensityBucket(
  adbClient: AdbClient,
  serial: string
): Promise<string | null> {
  try {
    const output = await adbClient.shellCommand(serial, ['wm', 'density'])
    const dpi = parseWmDensity(output)
    return dpi !== null ? mapDpiToDensityBucket(dpi) : null
  } catch {
    return null
  }
}

/**
 * Classifies one part, preferring the manifest's own `split` attribute
 * (authoritative — see classifySplitAttribute) and only falling back to
 * the file name when nothing could be parsed from the file at all. A
 * successfully-parsed file with no `split` attribute is the base by
 * definition (see RawSplitPart.splitAttribute) — this is never inferred
 * from the file name.
 */
function resolvePartClassification(raw: RawSplitPart): SplitFileNameClassification & {
  rawSplitAttribute: string | null
} {
  if (raw.parseError !== null) {
    return { ...classifySplitFileName(raw.fileName), rawSplitAttribute: null }
  }
  if (raw.splitAttribute === null) {
    return { role: 'base', abi: null, density: null, language: null, rawSplitAttribute: null }
  }
  const fromMetadata = classifySplitAttribute(raw.splitAttribute)
  if (fromMetadata) {
    return { ...fromMetadata, rawSplitAttribute: raw.splitAttribute }
  }
  // A split attribute is present but doesn't match the "config.<qualifier>"
  // shape this app knows how to classify further (e.g. a named dynamic
  // feature module) — still authoritatively *not* the base, but not
  // further classifiable either. The raw value is kept for display.
  return {
    role: 'unknown',
    abi: null,
    density: null,
    language: null,
    rawSplitAttribute: raw.splitAttribute
  }
}

function toSplitApkPart(raw: RawSplitPart, deviceAbiList: string[]): SplitApkPart {
  const classification = resolvePartClassification(raw)
  const deviceCompatible =
    classification.role !== 'abi' ||
    (classification.abi !== null && deviceAbiList.includes(classification.abi))

  return {
    filePath: raw.filePath,
    fileName: raw.fileName,
    fileSizeBytes: raw.fileSizeBytes,
    role: classification.role,
    abi: classification.abi,
    density: classification.density,
    language: classification.language,
    rawSplitAttribute: classification.rawSplitAttribute,
    packageName: raw.packageName,
    versionName: raw.versionName,
    versionCode: raw.versionCode,
    minSdkVersion: raw.minSdkVersion,
    targetSdkVersion: raw.targetSdkVersion,
    label: raw.label,
    iconDataUrl: raw.iconDataUrl,
    deviceCompatible
  }
}

/**
 * Finds the base APK, per the spec's strict rule: exactly one part with
 * role 'base' is required to continue at all — zero or more than one both
 * block installation rather than guessing which one was "probably" meant.
 */
function resolveBase(parts: SplitApkPart[]): {
  base: SplitApkPart | null
  baseCandidates: SplitApkPart[]
} {
  const baseCandidates = parts.filter((part) => part.role === 'base')
  return { base: baseCandidates.length === 1 ? (baseCandidates[0] ?? null) : null, baseCandidates }
}

/**
 * Inspects a split/bundle install source (an .apks/.xapk/.apkm archive, a
 * folder of split APKs, or a set of individually-picked .apk files) and
 * reports what would happen installing it on this specific device: which
 * file is the base, which native-library splits actually match this
 * device's supported ABIs, whether the set is internally consistent (one
 * package name, matching version codes), and whether the device's Android
 * version is new enough. Never mutates the device — this is the read-only
 * "Analyze"/"Validate" step of the install wizard.
 */
export async function buildSplitInstallAnalysis(
  adbClient: AdbClient,
  serial: string,
  sourceKind: SplitSourceKind,
  sourcePaths: string[],
  parseApk?: ParseApkFn
): Promise<SplitInstallAnalysis> {
  const {
    parts: rawParts,
    cleanupDir,
    skippedNonApkEntries
  } = await resolveSplitSource(sourceKind, sourcePaths, parseApk)
  try {
    const [properties, deviceDensityBucket] = await Promise.all([
      adbClient.getDeviceProperties(serial),
      resolveDeviceDensityBucket(adbClient, serial)
    ])
    const deviceAbiList = resolveDeviceAbiList(properties)
    const devicePrimaryAbi = deviceAbiList[0] ?? null
    const deviceSdkVersion = resolveDeviceSdkVersion(properties)

    const parts = rawParts.map((raw) => toSplitApkPart(raw, deviceAbiList))
    const issues: SplitInstallIssue[] = []

    for (const raw of rawParts) {
      if (raw.parseError) {
        issues.push({
          code: 'unreadable-part',
          severity: 'warning',
          message: `"${raw.fileName}" couldn't be read as an APK (${raw.parseError}) — it will still be sent to the device as-is.`
        })
      }
    }

    if (skippedNonApkEntries.length > 0) {
      issues.push({
        code: 'non-apk-content-present',
        severity: 'info',
        message: `This archive also contains ${skippedNonApkEntries.length} non-APK file(s) (${skippedNonApkEntries
          .slice(0, 5)
          .join(
            ', '
          )}${skippedNonApkEntries.length > 5 ? ', …' : ''}) that droid.or does not install.`
      })
    }

    const { base, baseCandidates } = resolveBase(parts)
    if (baseCandidates.length === 0) {
      issues.push({
        code: 'no-base-apk-detected',
        severity: 'error',
        message:
          'No base APK was found in this set — every valid split set has exactly one file with no `split` attribute in its manifest.'
      })
    } else if (baseCandidates.length > 1) {
      issues.push({
        code: 'multiple-base-apks-detected',
        severity: 'error',
        message: `Found ${baseCandidates.length} files that all look like a base APK (${baseCandidates
          .map((part) => part.fileName)
          .join(', ')}) — a valid split set has exactly one.`
      })
    }

    if (parts.length > 1) {
      issues.push({
        code: 'signing-consistency-not-verifiable',
        severity: 'info',
        message:
          "droid.or's current APK inspection cannot verify that these files share the same signing certificate — Android's own installer will still reject the set at install time if they don't."
      })
    }

    const distinctPackageNames = [
      ...new Set(
        parts.map((part) => part.packageName).filter((name): name is string => name !== null)
      )
    ]
    const packageName = base?.packageName ?? distinctPackageNames[0] ?? null

    if (distinctPackageNames.length > 1) {
      issues.push({
        code: 'package-name-mismatch',
        severity: 'error',
        message: `These files don't all belong to the same app: ${distinctPackageNames.join(', ')}.`
      })
    } else if (packageName === null) {
      issues.push({
        code: 'package-name-mismatch',
        severity: 'error',
        message: 'Could not determine a package name from any of these files.'
      })
    }

    // Computed here (rather than gated behind canInstall, further down)
    // so a downgrade attempt can be surfaced as its own issue alongside
    // whatever else this analysis finds, instead of only appearing as a
    // small tag in the header.
    const plan =
      base && packageName
        ? await getInstallPlan(adbClient, serial, {
            filePath: base.filePath,
            fileName: base.fileName,
            fileSizeBytes: base.fileSizeBytes,
            packageName,
            versionName: base.versionName,
            versionCode: base.versionCode,
            minSdkVersion: base.minSdkVersion,
            targetSdkVersion: base.targetSdkVersion,
            label: base.label,
            iconDataUrl: base.iconDataUrl
          })
        : null

    if (plan?.operation === 'downgrade-attempt' && base) {
      issues.push({
        code: 'downgrade-attempt',
        severity: 'warning',
        message: `The device has version code ${plan.currentVersionCode} installed, which is newer than this set (code ${base.versionCode ?? 'unknown'}). Android will reject this install unless the existing app is uninstalled first.`
      })
    }

    const distinctVersionCodes = [
      ...new Set(
        parts.map((part) => part.versionCode).filter((code): code is number => code !== null)
      )
    ]
    if (distinctVersionCodes.length > 1) {
      issues.push({
        code: 'version-code-mismatch',
        severity: 'warning',
        message: `These files report different version codes (${distinctVersionCodes.join(', ')}) — they may not be from the same release.`
      })
    }

    const maxMinSdkVersion = parts.reduce<number | null>((max, part) => {
      if (part.minSdkVersion === null) {
        return max
      }
      return max === null ? part.minSdkVersion : Math.max(max, part.minSdkVersion)
    }, null)
    if (
      maxMinSdkVersion !== null &&
      deviceSdkVersion !== null &&
      maxMinSdkVersion > deviceSdkVersion
    ) {
      issues.push({
        code: 'min-sdk-too-high',
        severity: 'error',
        message: `This app requires Android API ${maxMinSdkVersion} or higher; this device is running API ${deviceSdkVersion}.`
      })
    }

    const abiParts = parts.filter((part) => part.role === 'abi')
    if (abiParts.length > 0 && !abiParts.some((part) => part.deviceCompatible)) {
      const foundAbis = abiParts.map((part) => part.abi).join(', ')
      const deviceAbis = deviceAbiList.length > 0 ? deviceAbiList.join(', ') : 'unknown'
      issues.push({
        code: 'no-compatible-abi-split',
        severity: 'error',
        message: `None of the native-library splits in this set (${foundAbis}) match this device's supported CPU architecture (${deviceAbis}).`
      })
    }

    const canInstall = base !== null && issues.every((issue) => issue.severity !== 'error')

    return {
      sourceKind,
      sourcePaths,
      packageName,
      versionName: base?.versionName ?? null,
      versionCode: base?.versionCode ?? null,
      label: base?.label ?? null,
      iconDataUrl: base?.iconDataUrl ?? null,
      devicePrimaryAbi,
      deviceDensityBucket,
      parts: orderSplitInstallParts(parts),
      issues,
      canInstall,
      plan
    }
  } finally {
    await cleanupSplitSource(cleanupDir)
  }
}

/**
 * Installs a split/bundle set via a single `adb install-multiple` call.
 * Re-resolves the source from scratch (re-extracting an archive into a
 * fresh temp directory if needed) rather than trusting a previously
 * returned analysis, for the same reason installLocalApk re-inspects a
 * single APK before installing it: what's on disk may have changed, and
 * this process never keeps server-side state between IPC calls. The base
 * part is always installed even if the caller's selection omitted it —
 * `install-multiple` cannot succeed without it.
 */
export async function performSplitInstall(
  db: Database.Database,
  adbClient: AdbClient,
  serial: string,
  sourceKind: SplitSourceKind,
  sourcePaths: string[],
  selectedFileNames: string[],
  parseApk?: ParseApkFn
): Promise<OperationResult> {
  const { parts: rawParts, cleanupDir } = await resolveSplitSource(
    sourceKind,
    sourcePaths,
    parseApk
  )
  try {
    const properties = await adbClient.getDeviceProperties(serial)
    const deviceAbiList = resolveDeviceAbiList(properties)
    const parts = rawParts.map((raw) => toSplitApkPart(raw, deviceAbiList))

    const { base, baseCandidates } = resolveBase(parts)
    if (baseCandidates.length === 0) {
      throw new Error(
        'No base APK was found in this set — every valid split set has exactly one file with no `split` attribute in its manifest.'
      )
    }
    if (!base) {
      throw new Error(
        `Found ${baseCandidates.length} files that all look like a base APK — a valid split set has exactly one.`
      )
    }

    const packageName =
      base.packageName ?? parts.find((part) => part.packageName !== null)?.packageName ?? null
    if (!packageName || !isValidPackageName(packageName)) {
      throw new Error('Refusing to install a set with an invalid or missing package name.')
    }

    const selectedNames = new Set(selectedFileNames)
    selectedNames.add(base.fileName)
    const orderedParts = orderSplitInstallParts(
      parts.filter((part) => selectedNames.has(part.fileName))
    )

    const plan = await getInstallPlan(adbClient, serial, {
      filePath: base.filePath,
      fileName: base.fileName,
      fileSizeBytes: base.fileSizeBytes,
      packageName,
      versionName: base.versionName,
      versionCode: base.versionCode,
      minSdkVersion: base.minSdkVersion,
      targetSdkVersion: base.targetSdkVersion,
      label: base.label,
      iconDataUrl: base.iconDataUrl
    })

    const mutation = await adbClient.installMultipleApks(
      serial,
      orderedParts.map((part) => part.filePath)
    )
    const rawOutput = [mutation.stdout, mutation.stderr].filter(Boolean).join('\n').trim()

    let success: boolean
    let message: string
    let newVersionCode: number | null = null

    if (!isInstallSuccessful(mutation.exitCode, mutation.stdout)) {
      success = false
      message = formatInstallFailureMessage(
        extractInstallFailureMessage(mutation.stdout, mutation.stderr)
      )
    } else {
      newVersionCode = await getInstalledVersionCode(adbClient, serial, packageName)
      success = newVersionCode !== null
      message = success
        ? describeInstallSuccess(plan.operation)
        : "adb reported success, but the app doesn't appear to be installed."
    }

    recordOperation(db, {
      deviceId: serial,
      packageName,
      operation: 'split-install',
      previousState:
        plan.currentVersionCode !== null
          ? `version code ${plan.currentVersionCode}`
          : 'not installed',
      newState: newVersionCode !== null ? `version code ${newVersionCode}` : null,
      success,
      rawOutput: `Installed from ${orderedParts.length} file(s): ${orderedParts
        .map((part) => part.fileName)
        .join(', ')}\n\n${rawOutput || '(no output)'}`
    })

    return { success, message, rawOutput: rawOutput || '(no output)' }
  } finally {
    await cleanupSplitSource(cleanupDir)
  }
}
