import type { SplitPartRole } from '@shared/validation/split-install.schema'

export interface SplitFileNameClassification {
  role: SplitPartRole
  abi: string | null
  density: string | null
  language: string | null
}

/** Every ABI qualifier bundletool/xapk/apkm split names use, mapped to the
 *  canonical `ro.product.cpu.abilist`-style spelling (hyphenated) so it can
 *  be compared directly against a device's reported ABI list. */
const ABI_QUALIFIERS: Record<string, string> = {
  arm64_v8a: 'arm64-v8a',
  armeabi_v7a: 'armeabi-v7a',
  armeabi: 'armeabi',
  x86_64: 'x86_64',
  x86: 'x86',
  mips64: 'mips64',
  mips: 'mips'
}

const DENSITY_QUALIFIERS = new Set([
  'ldpi',
  'mdpi',
  'tvdpi',
  'hdpi',
  'xhdpi',
  'xxhdpi',
  'xxxhdpi',
  'nodpi',
  'anydpi'
])

/** The fixed dpi reference points Android's own DisplayMetrics.DENSITY_*
 *  constants define for each bucket. */
const DENSITY_BUCKET_DPI: ReadonlyArray<{ bucket: string; dpi: number }> = [
  { bucket: 'ldpi', dpi: 120 },
  { bucket: 'mdpi', dpi: 160 },
  { bucket: 'tvdpi', dpi: 213 },
  { bucket: 'hdpi', dpi: 240 },
  { bucket: 'xhdpi', dpi: 320 },
  { bucket: 'xxhdpi', dpi: 480 },
  { bucket: 'xxxhdpi', dpi: 640 }
]

/**
 * Maps a device's reported physical density (from `wm density`, in dpi) to
 * the nearest standard bucket, so the install UI can pre-select the one
 * density split the device would actually use instead of every density
 * split in the set. This is a nearest-value approximation, not Android's
 * exact resource-qualifier matching algorithm (which additionally weighs a
 * higher-density match more favorably than a lower one) — good enough to
 * pick a sensible default; it never gates or blocks an install, so an
 * imprecise pick here has no correctness consequence, only a slightly
 * different pre-checked default.
 */
export function mapDpiToDensityBucket(dpi: number): string {
  return DENSITY_BUCKET_DPI.reduce((closest, candidate) =>
    Math.abs(dpi - candidate.dpi) < Math.abs(dpi - closest.dpi) ? candidate : closest
  ).bucket
}

/** A qualifier is treated as a language when it looks like a BCP-47-ish tag
 *  (2-3 letter language, optionally a region/script suffix) and isn't
 *  already claimed as an ABI or density qualifier above. */
const LANGUAGE_QUALIFIER_PATTERN = /^[a-z]{2,3}(_[a-z0-9]+)*$/

function classifyQualifier(rawQualifier: string): SplitFileNameClassification {
  const qualifier = rawQualifier.toLowerCase().replace(/-/g, '_')

  const abi = ABI_QUALIFIERS[qualifier]
  if (abi) {
    return { role: 'abi', abi, density: null, language: null }
  }
  if (DENSITY_QUALIFIERS.has(qualifier)) {
    return { role: 'density', abi: null, density: qualifier, language: null }
  }
  if (LANGUAGE_QUALIFIER_PATTERN.test(qualifier)) {
    return { role: 'language', abi: null, density: null, language: qualifier.replace(/_/g, '-') }
  }
  return { role: 'unknown', abi: null, density: null, language: null }
}

/**
 * Classifies a split from the manifest's own `split` attribute (see
 * RawApkInfo.split) — bundletool's documented convention is
 * "config.<abi|density|language>" for a configuration split, or the
 * feature module's bare name for a dynamic feature split. This is the
 * spec-mandated *authoritative* classification: it comes from the actual
 * parsed manifest, not a guess about the file name, and third-party
 * repackagers (.xapk/.apkm) preserve it from the original APK bytes even
 * when they rename the file. Returns null when there's no split attribute
 * at all (the base APK never has one) or it doesn't match the
 * "config.<qualifier>" shape this app knows how to classify further (e.g.
 * a named feature module) — in the latter case the raw value is still
 * meaningful to show the user, just not further classifiable.
 */
export function classifySplitAttribute(
  splitAttribute: string | null | undefined
): SplitFileNameClassification | null {
  if (!splitAttribute) {
    return null
  }
  const configMatch = /^config\.(.+)$/i.exec(splitAttribute)
  if (!configMatch?.[1]) {
    return null
  }
  return classifyQualifier(configMatch[1])
}

/**
 * Classifies a single split APK file purely by its file name, following the
 * naming conventions documented for bundletool's APK_SET output
 * ("base.apk", "split_config.<qualifier>.apk" —
 * https://developer.android.com/tools/bundletool) and the equivalent
 * "config.<qualifier>.apk" convention used by third-party split-apk
 * distribution formats (.xapk, .apkm). This is a *fallback only*, used
 * when a file's manifest couldn't be read at all (see
 * classifySplitAttribute, which is authoritative whenever the manifest was
 * readable) — never used to override or second-guess a value the manifest
 * actually provided. Not verified against a real bundletool-generated set
 * this session (none was available) — this is inference from those
 * documented, widely-stable naming schemes, not a device-verified
 * behavior. A file that matches none of these patterns is classified
 * 'unknown' and always kept in the install set rather than silently
 * dropped.
 */
export function classifySplitFileName(fileName: string): SplitFileNameClassification {
  const withoutExtension = fileName.replace(/\.apk$/i, '')
  const lower = withoutExtension.toLowerCase()

  if (lower === 'base' || lower === 'standalone') {
    return { role: 'base', abi: null, density: null, language: null }
  }

  const configMatch = /^(?:split_config|split-config|config|split)[._-](.+)$/.exec(lower)
  if (configMatch?.[1]) {
    return classifyQualifier(configMatch[1])
  }

  return { role: 'unknown', abi: null, density: null, language: null }
}

const ROLE_INSTALL_ORDER: Record<SplitPartRole, number> = {
  base: 0,
  abi: 1,
  density: 2,
  language: 3,
  unknown: 4
}

/**
 * Orders parts base → abi → density → language → unknown, the order the
 * spec asks `adb install-multiple` to receive them in (base first is the
 * only part adb itself actually requires; the rest is a deterministic,
 * readable convention rather than an ADB requirement).
 */
export function orderSplitInstallParts<T extends { role: SplitPartRole; fileName: string }>(
  parts: T[]
): T[] {
  return [...parts].sort((a, b) => {
    const roleDiff = ROLE_INSTALL_ORDER[a.role] - ROLE_INSTALL_ORDER[b.role]
    return roleDiff !== 0 ? roleDiff : a.fileName.localeCompare(b.fileName)
  })
}
