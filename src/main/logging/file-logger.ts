import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export interface FileLoggerOptions {
  /** Size at which the current file is rotated. */
  maxBytes?: number
  /** Files kept in total, current one included. */
  maxFiles?: number
}

export const LOG_FILE_NAME = 'droid-or.log'

/**
 * Plain-text, size-capped log in `userData/logs` for bug reports: at most
 * `maxFiles` × `maxBytes` on disk (3 MB by default). Writes are synchronous
 * so the last lines before a crash are on disk, which is affordable at
 * this app's volume (a few lines per user action). Stays on the machine —
 * it is only ever shared by the user attaching it to an issue.
 *
 * Logging must never break the app: every filesystem error is swallowed.
 */
export class FileLogger {
  readonly directory: string
  private readonly filePath: string
  private readonly maxBytes: number
  private readonly maxFiles: number

  constructor(directory: string, options: FileLoggerOptions = {}) {
    this.directory = directory
    this.filePath = join(directory, LOG_FILE_NAME)
    this.maxBytes = options.maxBytes ?? 1_000_000
    this.maxFiles = Math.max(1, options.maxFiles ?? 3)
    try {
      mkdirSync(directory, { recursive: true })
    } catch {
      // Unwritable directory: every later write fails silently too.
    }
  }

  info(message: string): void {
    this.write('INFO', message)
  }

  warn(message: string): void {
    this.write('WARN', message)
  }

  error(message: string, error?: unknown): void {
    const detail =
      error instanceof Error
        ? (error.stack ?? error.message)
        : error === undefined
          ? ''
          : String(error)
    this.write('ERROR', detail ? `${message}\n${detail}` : message)
  }

  private write(level: LogLevel, message: string): void {
    const line = `${new Date().toISOString()} ${level.padEnd(5)} ${message}\n`
    try {
      this.rotateIfNeeded(Buffer.byteLength(line))
      appendFileSync(this.filePath, line, 'utf-8')
    } catch {
      // Disk full, permissions, …: never let logging take the app down.
    }
  }

  private rotateIfNeeded(incomingBytes: number): void {
    let size: number
    try {
      size = statSync(this.filePath).size
    } catch {
      return
    }
    if (size + incomingBytes <= this.maxBytes) {
      return
    }
    // droid-or.log → droid-or.1.log → … → droid-or.<maxFiles-1>.log (dropped)
    rmSync(this.rotatedPath(this.maxFiles - 1), { force: true })
    for (let index = this.maxFiles - 2; index >= 1; index--) {
      try {
        renameSync(this.rotatedPath(index), this.rotatedPath(index + 1))
      } catch {
        // That generation doesn't exist yet.
      }
    }
    if (this.maxFiles > 1) {
      renameSync(this.filePath, this.rotatedPath(1))
    } else {
      rmSync(this.filePath, { force: true })
    }
  }

  private rotatedPath(index: number): string {
    return join(this.directory, LOG_FILE_NAME.replace(/\.log$/, `.${index}.log`))
  }
}
