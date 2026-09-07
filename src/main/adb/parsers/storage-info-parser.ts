export interface StorageInfo {
  totalKb: number | null
  availableKb: number | null
}

/**
 * Parses `df /data` (no -h, so units stay fixed 1K-blocks rather than a
 * rounded human-readable suffix that's harder to parse reliably). Verified
 * against a real device: the "Mounted on" column can read "/data/user/0"
 * rather than "/data" even though that's the path queried, so this parses
 * by column position on the first data row rather than matching the mount
 * point text.
 */
export function parseStorageInfo(output: string): StorageInfo {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const dataLine = lines[1]
  if (!dataLine) {
    return { totalKb: null, availableKb: null }
  }

  const fields = dataLine.split(/\s+/)
  const total = fields[1] ? Number.parseInt(fields[1], 10) : Number.NaN
  const available = fields[3] ? Number.parseInt(fields[3], 10) : Number.NaN

  return {
    totalKb: Number.isFinite(total) ? total : null,
    availableKb: Number.isFinite(available) ? available : null
  }
}
