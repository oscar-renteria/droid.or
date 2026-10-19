import type { KnownDevice } from '@shared/types/device'

/** One naming rule for a device everywhere it's shown (sidebar, header,
 *  Overview title), so the same phone never appears under two names. */
export function deviceDisplayName(device: KnownDevice): string {
  if (device.nickname) {
    return device.nickname
  }
  if (device.manufacturer && device.model) {
    return `${device.manufacturer} ${device.model}`
  }
  if (device.model) {
    return device.model
  }
  return device.connectionState === 'no-permissions' ? 'Unknown device' : device.id
}
