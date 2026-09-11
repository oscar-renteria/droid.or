import type { SplitInstallAnalysis } from '@shared/types/split-install'

/**
 * Picks which non-base parts should start out checked in the Confirm step.
 *
 * For ABI and density splits specifically, "every device-compatible part"
 * is a poor default: a 64-bit device's ABI list usually also includes the
 * 32-bit ABI for compatibility, and a density-split bundle typically ships
 * one file per bucket (ldpi..xxxhdpi) — pre-checking all of them would
 * install redundant native code and graphical assets the device will
 * never use. Instead, when the analysis knows the device's actual primary
 * ABI/density bucket, only the one matching part is pre-selected; the
 * others stay compatible (so the user can still opt into them, e.g. to
 * cover a secondary display) but unchecked. Falls back to selecting every
 * compatible part for that role when the device's preference couldn't be
 * determined, or when none of the parts actually match it — better to
 * over-select than to silently end up with zero native code/resources of
 * that kind selected at all.
 */
export function computeDefaultSelectedFileNames(analysis: SplitInstallAnalysis): Set<string> {
  const compatibleAbiParts = analysis.parts.filter(
    (part) => part.role === 'abi' && part.deviceCompatible
  )
  const preferredAbiPart = compatibleAbiParts.find((part) => part.abi === analysis.devicePrimaryAbi)

  const compatibleDensityParts = analysis.parts.filter(
    (part) => part.role === 'density' && part.deviceCompatible
  )
  const preferredDensityPart = compatibleDensityParts.find(
    (part) => part.density === analysis.deviceDensityBucket
  )

  const selected = analysis.parts.filter((part) => {
    if (part.role === 'base' || !part.deviceCompatible) {
      return false
    }
    if (part.role === 'abi') {
      return preferredAbiPart ? part.fileName === preferredAbiPart.fileName : true
    }
    if (part.role === 'density') {
      return preferredDensityPart ? part.fileName === preferredDensityPart.fileName : true
    }
    return true
  })

  return new Set(selected.map((part) => part.fileName))
}
