import type { BootloaderState } from '@shared/validation/device-dashboard.schema'

/**
 * Maps ro.boot.verifiedbootstate (Android Verified Boot) to a display state.
 * Present on essentially any Treble device (Android 8+), i.e. the whole
 * supported range. Absent/empty on emulators — mapped to 'unknown' rather
 * than guessing.
 */
export function getBootloaderState(verifiedBootState: string | null | undefined): BootloaderState {
  switch (verifiedBootState) {
    case 'green':
      return 'locked'
    case 'orange':
      return 'unlocked'
    case 'yellow':
      return 'unlocked-custom-key'
    case 'red':
      return 'verification-failed'
    default:
      return 'unknown'
  }
}
