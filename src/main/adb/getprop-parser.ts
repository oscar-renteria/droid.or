/**
 * Parses the output of `adb shell getprop`, which is always formatted as
 * `[key]: [value]` (brackets literal), one property per line. Long-standing
 * and stable across Android versions and manufacturers — every AOSP-derived
 * device implements getprop this way.
 */
export function parseGetprop(output: string): Map<string, string> {
  const properties = new Map<string, string>()
  const pattern = /^\[([^\]]+)\]:\s*\[([^\]]*)\]\s*$/

  for (const line of output.split('\n')) {
    const match = pattern.exec(line.trim())
    if (match?.[1] !== undefined && match[2] !== undefined) {
      properties.set(match[1], match[2])
    }
  }

  return properties
}
