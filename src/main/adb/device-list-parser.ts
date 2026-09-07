import type { DeviceConnectionState } from '@shared/validation/device.schema'

/**
 * One row from `adb devices -l` (or a track-devices frame payload, which has
 * the same row format but no "List of devices attached" header line).
 */
export interface RawAdbDevice {
  /** ADB serial, or null for the Linux "no permissions" placeholder row,
   *  which has no readable serial at all. */
  serial: string | null
  state: DeviceConnectionState
  /** Present only for the 'no-permissions' state: adb's raw diagnostic text
   *  (e.g. "no permissions (user in plugdev group; ...)"),  shown to the
   *  user as-is since it already names the actual fix. */
  diagnosticMessage: string | null
  /** Extra `key:value` fields -l adds when available (product, model,
   *  device, transport_id, usb). Not present for every state — in
   *  particular, an unauthorized device typically has none of these yet,
   *  since the handshake that would reveal them never completed. */
  properties: Record<string, string>
}

const KNOWN_STATES: ReadonlySet<string> = new Set([
  'device',
  'unauthorized',
  'authorizing',
  'offline',
  'sideload',
  'recovery'
])

/**
 * Parses the device-list body adb emits both from `adb devices -l` (after
 * stripping the header line and any daemon-startup "* ..." status lines) and
 * from each `adb track-devices -l` frame payload (which has no header line
 * at all). Unknown state tokens are mapped to 'offline' rather than
 * discarded or thrown on: a device in some future or OEM-specific state
 * should still show up as "present but unusable" rather than disappear.
 */
export function parseDeviceListBody(body: string): RawAdbDevice[] {
  return body
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.startsWith('*'))
    .map(parseDeviceLine)
}

function parseDeviceLine(line: string): RawAdbDevice {
  const tabIndex = line.indexOf('\t')
  const serialField = tabIndex === -1 ? line : line.slice(0, tabIndex)
  const rest = (tabIndex === -1 ? '' : line.slice(tabIndex + 1)).trim()

  if (rest.startsWith('no permissions')) {
    return {
      serial: null,
      state: 'no-permissions',
      diagnosticMessage: rest,
      properties: {}
    }
  }

  const tokens = rest.split(/\s+/).filter(Boolean)
  const stateToken = tokens[0] ?? 'offline'
  const state: DeviceConnectionState = KNOWN_STATES.has(stateToken)
    ? (stateToken as DeviceConnectionState)
    : 'offline'

  const properties: Record<string, string> = {}
  for (const token of tokens.slice(1)) {
    const colonIndex = token.indexOf(':')
    if (colonIndex > 0) {
      properties[token.slice(0, colonIndex)] = token.slice(colonIndex + 1)
    }
  }

  return {
    serial: serialField.length > 0 ? serialField : null,
    state,
    diagnosticMessage: null,
    properties
  }
}
