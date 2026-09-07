import { describe, expect, it } from 'vitest'
import { parseDeviceListBody } from '@main/adb/device-list-parser'

describe('parseDeviceListBody', () => {
  it('returns an empty list for an empty body', () => {
    expect(parseDeviceListBody('')).toEqual([])
  })

  it('parses an authorized device with -l fields', () => {
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
    const body = 'R58N123ABCD\tunauthorized usb:1-3 transport_id:5'
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
      '????????????\tno permissions (user in plugdev group; are your udev rules wrong?); see [http://developer.android.com/tools/device.html]'
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
    const result = parseDeviceListBody('ABC123\tsome-future-state')
    expect(result).toEqual([
      { serial: 'ABC123', state: 'offline', diagnosticMessage: null, properties: {} }
    ])
  })

  it('ignores daemon-startup status lines and blank lines', () => {
    const body = [
      '* daemon not running; starting now at tcp:5037',
      '* daemon started successfully',
      '',
      'ABC123\tdevice'
    ].join('\n')
    const result = parseDeviceListBody(body)
    expect(result).toEqual([
      { serial: 'ABC123', state: 'device', diagnosticMessage: null, properties: {} }
    ])
  })

  it('parses multiple devices', () => {
    const body = ['ABC123\tdevice', 'DEF456\tunauthorized'].join('\n')
    expect(parseDeviceListBody(body)).toHaveLength(2)
  })
})
