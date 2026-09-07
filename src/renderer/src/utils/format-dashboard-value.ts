import type { BootloaderState, RootHeuristicVerdict } from '@shared/types/device-dashboard'

const NOT_AVAILABLE = 'Not available'

export function formatText(value: string | number | null): string {
  return value === null || value === '' ? NOT_AVAILABLE : String(value)
}

export function formatMegabytes(mb: number | null): string {
  if (mb === null) {
    return NOT_AVAILABLE
  }
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}

export function formatPercent(value: number | null): string {
  return value === null ? NOT_AVAILABLE : `${value}%`
}

export function formatCelsius(value: number | null): string {
  return value === null ? NOT_AVAILABLE : `${value.toFixed(1)} °C`
}

export function formatHz(value: number | null): string {
  return value === null ? NOT_AVAILABLE : `${value} Hz`
}

export function formatBoolean(value: boolean | null, trueLabel = 'Yes', falseLabel = 'No'): string {
  if (value === null) {
    return NOT_AVAILABLE
  }
  return value ? trueLabel : falseLabel
}

export function formatUptime(seconds: number | null): string {
  if (seconds === null) {
    return NOT_AVAILABLE
  }
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) {
    parts.push(`${days}d`)
  }
  if (days > 0 || hours > 0) {
    parts.push(`${hours}h`)
  }
  parts.push(`${minutes}m`)
  return parts.join(' ')
}

const BOOTLOADER_LABELS: Record<BootloaderState, string> = {
  locked: 'Locked',
  unlocked: 'Unlocked',
  'unlocked-custom-key': 'Unlocked (custom key)',
  'verification-failed': 'Verification failed',
  unknown: 'Unknown'
}

export function formatBootloaderState(state: BootloaderState): string {
  return BOOTLOADER_LABELS[state]
}

const ROOT_HEURISTIC_LABELS: Record<RootHeuristicVerdict, string> = {
  likely: 'Likely (heuristic)',
  possible: 'Possibly modified (heuristic)',
  unlikely: 'Unlikely (heuristic)'
}

export function formatRootHeuristic(verdict: RootHeuristicVerdict): string {
  return ROOT_HEURISTIC_LABELS[verdict]
}
