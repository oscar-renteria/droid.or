export type AdbCommandLogCategory =
  | 'list-devices'
  | 'get-properties'
  | 'shell'
  | 'mutation'
  | 'pull-file'
  | 'install-apk'
  | 'install-multiple-apk'

export interface AdbCommandLogEntry {
  id: number
  timestamp: string
  deviceId: string | null
  category: AdbCommandLogCategory
  command: string
  durationMs: number
  success: boolean
  errorMessage: string | null
}

export type RecordAdbCommandInput = Omit<AdbCommandLogEntry, 'id' | 'timestamp'>

const MAX_ENTRIES = 500

/**
 * In-memory ring buffer of every discrete ADB command this app has run
 * this session. Deliberately not persisted (unlike operation history,
 * which the spec requires to survive restarts) — this is a live
 * troubleshooting view, not a record users need back after quitting the
 * app, so a capped in-memory buffer avoids growing the SQLite database
 * with routine read-only traffic (a single dashboard refresh alone is a
 * dozen-plus commands).
 */
export class AdbCommandLog {
  private entries: AdbCommandLogEntry[] = []
  private nextId = 1

  record(input: RecordAdbCommandInput): void {
    this.entries.push({ id: this.nextId, timestamp: new Date().toISOString(), ...input })
    this.nextId += 1
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift()
    }
  }

  /** Newest first, matching every other list view in this app. */
  getAll(): AdbCommandLogEntry[] {
    return [...this.entries].reverse()
  }

  clear(): void {
    this.entries = []
  }
}
