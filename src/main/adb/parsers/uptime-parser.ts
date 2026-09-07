/** /proc/uptime is "seconds_since_boot idle_seconds_summed_across_cores" —
 *  only the first value is uptime. */
export function parseUptimeSeconds(output: string): number | null {
  const firstToken = output.trim().split(/\s+/)[0]
  if (!firstToken) {
    return null
  }
  const seconds = Number.parseFloat(firstToken)
  return Number.isFinite(seconds) ? seconds : null
}
