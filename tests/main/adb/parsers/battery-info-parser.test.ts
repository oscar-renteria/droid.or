import { describe, expect, it } from 'vitest'
import { parseBatteryInfo } from '@main/adb/parsers/battery-info-parser'

// Trimmed from a real `adb shell dumpsys battery` capture (Samsung Galaxy Z
// Flip, Android 16) — includes the EventLogBuffer noise that repeats
// "level:"/"health:" with no leading space and no line of their own, which
// is exactly what the parser must not match.
const REAL_SAMPLE = `Current Battery Service state:
  AC powered: false
  USB powered: true
  Wireless powered: false
  Max charging current: 0
  Charge counter: 2473800
  status: 2
  health: 2
  present: true
  level: 59
  scale: 100
  voltage: 3965
  temperature: 312
  technology: Li-ion

[EventLogBuffer]
09-07 20:30:07.653  Sending ACTION_BATTERY_CHANGED: level:55, status:2, health:2, remain:0, voltage:3863, temperature:284
09-07 21:02:14.039  Sending ACTION_BATTERY_CHANGED: level:59, status:2, health:2, remain:9952, voltage:3960, temperature:314
`

describe('parseBatteryInfo', () => {
  it('parses percent, temperature, and health from the real capture, ignoring EventLogBuffer noise', () => {
    const result = parseBatteryInfo(REAL_SAMPLE)
    expect(result).toEqual({ percent: 59, temperatureCelsius: 31.2, health: 'Good' })
  })

  it('returns nulls when the expected fields are entirely absent', () => {
    expect(parseBatteryInfo('unexpected output')).toEqual({
      percent: null,
      temperatureCelsius: null,
      health: null
    })
  })

  it('maps every documented BatteryManager health constant', () => {
    expect(parseBatteryInfo('level: 50\nscale: 100\nhealth: 3').health).toBe('Overheat')
    expect(parseBatteryInfo('level: 50\nscale: 100\nhealth: 4').health).toBe('Dead')
    expect(parseBatteryInfo('level: 50\nscale: 100\nhealth: 7').health).toBe('Cold')
  })

  it('falls back to "Unknown" for an undocumented health code rather than null', () => {
    expect(parseBatteryInfo('health: 99').health).toBe('Unknown')
  })
})
