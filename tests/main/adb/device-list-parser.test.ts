import { describe, expect, it } from 'vitest'
import { parseDeviceListBody } from '@main/adb/device-list-parser'

describe('parseDeviceListBody', () => {
  it('returns an empty list for an empty body', () => {
    expect(parseDeviceListBody('')).toEqual([])
  })

  it('parses the exact row captured from a real Samsung device (space-padded, not tab-separated)', () => {
    // Captured verbatim via `adb track-devices -l` against a real Galaxy Z
    // Flip: the serial/state column is separated by space-padding for
    // column alignment, not a tab character.
    const body =
      'R5CY73MF2QL            device usb:1-2 product:b7sxeea model:SM_F766B device:b7s transport_id:2'
    const result = parseDeviceListBody(body)
    expect(result).toEqual([
      {
        serial: 'R5CY73MF2QL',
        state: 'device',
        diagnosticMessage: null,
        properties: {
          usb: '1-2',
          product: 'b7sxeea',
          model: 'SM_F766B',
          device: 'b7s',
          transport_id: '2'
        }
      }
    ])
  })

  it('parses a tab-separated row too, in case some adb build emits one', () => {
    const body =
      'R58N123ABCD\tdevice usb:1-3 product:dm3qsq model:SM_S911B device:dm3q transport_id:5'
    const result = parseDeviceListBody(body)
    expect(result).toEqual([
      {
        serial: 'R58N123ABCD',
        state: 'device',
        diagnosticMessage: null,
        properties: {
          usb: '1-3',
          product: 'dm3qsq',
          model: 'SM_S911B',
          device: 'dm3q',
          transport_id: '5'
        }
      }
    ])
  })

  it('parses an unauthorized device with no extra fields', () => {
    const body = 'R58N123ABCD           unauthorized usb:1-3 transport_id:5'
    const result = parseDeviceListBody(body)
    expect(result).toEqual([
      {
        serial: 'R58N123ABCD',
        state: 'unauthorized',
        diagnosticMessage: null,
        properties: { usb: '1-3', transport_id: '5' }
      }
    ])
  })

  it('parses the Linux "no permissions" placeholder row', () => {
    const body =
      '????????????           no permissions (user in plugdev group; are your udev rules wrong?); see [http://developer.android.com/tools/device.html]'
    const result = parseDeviceListBody(body)
    expect(result).toEqual([
      {
        serial: null,
        state: 'no-permissions',
        diagnosticMessage:
          'no permissions (user in plugdev group; are your udev rules wrong?); see [http://developer.android.com/tools/device.html]',
        properties: {}
      }
    ])
  })

  it('maps an unrecognized state token to offline instead of throwing', () => {
    const result = parseDeviceListBody('ABC123           some-future-state')
    expect(result).toEqual([
      { serial: 'ABC123', state: 'offline', diagnosticMessage: null, properties: {} }
    ])
  })

  it('ignores daemon-startup status lines and blank lines', () => {
    const body = [
      '* daemon not running; starting now at tcp:5037',
      '* daemon started successfully',
      '',
      'ABC123           device'
    ].join('\n')
    const result = parseDeviceListBody(body)
    expect(result).toEqual([
      { serial: 'ABC123', state: 'device', diagnosticMessage: null, properties: {} }
    ])
  })

  it('parses multiple devices', () => {
    const body = ['ABC123           device', 'DEF456           unauthorized'].join('\n')
    expect(parseDeviceListBody(body)).toHaveLength(2)
  })
})
