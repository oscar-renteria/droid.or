export interface MemoryInfo {
  totalKb: number | null
  /** MemAvailable, not MemFree: MemFree excludes reclaimable cache and
   *  understates what's actually usable. MemAvailable has been present in
   *  every Linux kernel since 3.14, i.e. every Android device in range. */
  availableKb: number | null
}

export function parseMeminfo(output: string): MemoryInfo {
  const totalMatch = /^MemTotal:\s*(\d+)\s*kB$/m.exec(output)
  const availableMatch = /^MemAvailable:\s*(\d+)\s*kB$/m.exec(output)

  return {
    totalKb: totalMatch?.[1] ? Number.parseInt(totalMatch[1], 10) : null,
    availableKb: availableMatch?.[1] ? Number.parseInt(availableMatch[1], 10) : null
  }
}
