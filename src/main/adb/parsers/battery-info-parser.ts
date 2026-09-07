export interface BatteryInfo {
  percent: number | null
  temperatureCelsius: number | null
  /** BatteryManager health constant, translated to a display label. Note:
   *  this only flags acute thermal/voltage/hardware faults. Virtually every
   *  real device reports "Good" almost all the time — it is not a
   *  capacity-wear indicator and will not detect a battery that has lost
   *  charge capacity over years of use. */
  health: string | null
}

const HEALTH_LABELS: Record<number, string> = {
  1: 'Unknown',
  2: 'Good',
  3: 'Overheat',
  4: 'Dead',
  5: 'Over voltage',
  6: 'Unspecified failure',
  7: 'Cold'
}

/**
 * `dumpsys battery`'s top "Current Battery Service state:" section uses
 * "key: value" lines; further down, an unrelated EventLogBuffer repeats some
 * of the same key names inside comma-joined log lines (e.g. "level:55,
 * status:2, ...") with no leading space and no line of their own. Requiring
 * the whole trimmed line to match `key: value` finds only the real field,
 * not a substring match inside that log noise.
 */
function findIntField(lines: string[], key: string): number | null {
  const pattern = new RegExp(`^${key}:\\s*(-?\\d+)$`)
  for (const line of lines) {
    const match = pattern.exec(line.trim())
    if (match?.[1] !== undefined) {
      return Number.parseInt(match[1], 10)
    }
  }
  return null
}

export function parseBatteryInfo(output: string): BatteryInfo {
  const lines = output.split('\n')
  const level = findIntField(lines, 'level')
  const scale = findIntField(lines, 'scale')
  const temperatureTenths = findIntField(lines, 'temperature')
  const healthCode = findIntField(lines, 'health')

  return {
    percent:
      level !== null && scale !== null && scale > 0 ? Math.round((level / scale) * 100) : null,
    temperatureCelsius: temperatureTenths !== null ? temperatureTenths / 10 : null,
    health: healthCode !== null ? (HEALTH_LABELS[healthCode] ?? 'Unknown') : null
  }
}
