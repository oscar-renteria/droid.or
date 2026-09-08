import type { AdbAvailability } from '@shared/validation/device.schema'
import type { AdbClient, MutationCommandResult } from './adb-client'
import type { AdbCommandLog, AdbCommandLogCategory } from './adb-command-log'
import type { RawAdbDevice } from './device-list-parser'

interface Outcome {
  success: boolean
  errorMessage: string | null
}

function mutationOutcome(result: MutationCommandResult): Outcome {
  if (result.exitCode === 0) {
    return { success: true, errorMessage: null }
  }
  return {
    success: false,
    errorMessage: result.stderr.trim() || result.stdout.trim() || `exit code ${result.exitCode}`
  }
}

/**
 * Wraps any AdbClient and logs every discrete request/response call to the
 * given AdbCommandLog, timing each one. This is the single place logging
 * instrumentation lives — every service that already calls
 * shellCommand/runMutationCommand/etc. (dashboard, packages, security
 * review, ...) gets a log entry for free, with no per-call-site changes.
 * The persistent `track-devices` watch isn't wrapped: it's a long-lived
 * stream, not a one-shot command with a single duration/result to log.
 */
export class LoggingAdbClient implements AdbClient {
  constructor(
    private readonly inner: AdbClient,
    private readonly log: AdbCommandLog
  ) {}

  getAvailability(): Promise<AdbAvailability> {
    return this.inner.getAvailability()
  }

  setAdbCommand(adbCommand: string): void {
    this.inner.setAdbCommand(adbCommand)
  }

  listDevicesOnce(): Promise<RawAdbDevice[]> {
    return this.record(null, 'list-devices', 'devices -l', () => this.inner.listDevicesOnce())
  }

  getDeviceProperties(serial: string): Promise<Map<string, string>> {
    return this.record(serial, 'get-properties', 'shell getprop', () =>
      this.inner.getDeviceProperties(serial)
    )
  }

  shellCommand(serial: string, args: string[]): Promise<string> {
    return this.record(serial, 'shell', args.join(' '), () => this.inner.shellCommand(serial, args))
  }

  runMutationCommand(serial: string, args: string[]): Promise<MutationCommandResult> {
    return this.record(
      serial,
      'mutation',
      args.join(' '),
      () => this.inner.runMutationCommand(serial, args),
      mutationOutcome
    )
  }

  pullFile(serial: string, remotePath: string, localPath: string): Promise<void> {
    return this.record(serial, 'pull-file', `pull ${remotePath}`, () =>
      this.inner.pullFile(serial, remotePath, localPath)
    )
  }

  installApk(serial: string, localApkPath: string): Promise<MutationCommandResult> {
    return this.record(
      serial,
      'install-apk',
      `install -r ${localApkPath}`,
      () => this.inner.installApk(serial, localApkPath),
      mutationOutcome
    )
  }

  watchDevices(
    onUpdate: (devices: RawAdbDevice[]) => void,
    onError: (error: Error) => void
  ): () => void {
    return this.inner.watchDevices(onUpdate, onError)
  }

  private async record<T>(
    deviceId: string | null,
    category: AdbCommandLogCategory,
    command: string,
    fn: () => Promise<T>,
    deriveOutcome?: (result: T) => Outcome
  ): Promise<T> {
    const start = Date.now()
    try {
      const result = await fn()
      const outcome = deriveOutcome ? deriveOutcome(result) : { success: true, errorMessage: null }
      this.log.record({ deviceId, category, command, durationMs: Date.now() - start, ...outcome })
      return result
    } catch (error) {
      this.log.record({
        deviceId,
        category,
        command,
        durationMs: Date.now() - start,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }
}
