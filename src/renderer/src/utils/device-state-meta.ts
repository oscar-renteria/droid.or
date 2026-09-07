import type { DeviceConnectionState } from '@shared/types/device'

export interface DeviceStateMeta {
  label: string
  dotClass: string
  /** Actionable guidance shown under the device row. Null when the state
   *  needs no explanation (connected, or a plain disconnected history entry). */
  guidance: string | null
}

const STATE_META: Record<DeviceConnectionState, DeviceStateMeta> = {
  device: { label: 'Connected', dotClass: 'bg-emerald-500', guidance: null },
  unauthorized: {
    label: 'Unauthorized',
    dotClass: 'bg-amber-500',
    guidance: 'Check the phone screen and tap "Allow" on the USB debugging authorization prompt.'
  },
  authorizing: {
    label: 'Authorizing',
    dotClass: 'bg-amber-500',
    guidance: 'Waiting for authorization — check the phone screen.'
  },
  offline: {
    label: 'Offline',
    dotClass: 'bg-gray-400',
    guidance: 'The device is listed but not responding. Try reconnecting the USB cable.'
  },
  sideload: {
    label: 'Sideload mode',
    dotClass: 'bg-sky-500',
    guidance: 'The device is running a custom recovery in sideload mode.'
  },
  recovery: {
    label: 'Recovery mode',
    dotClass: 'bg-sky-500',
    guidance: 'The device is in recovery mode.'
  },
  'no-permissions': {
    label: 'No permission',
    dotClass: 'bg-red-500',
    guidance:
      'Linux denied access to this USB device. Add a udev rule for Android devices, then unplug and reconnect the cable.'
  },
  disconnected: {
    label: 'Not connected',
    dotClass: 'bg-gray-300 dark:bg-gray-700',
    guidance: null
  }
}

export function getDeviceStateMeta(state: DeviceConnectionState): DeviceStateMeta {
  return STATE_META[state]
}
