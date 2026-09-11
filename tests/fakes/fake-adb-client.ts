import type { AdbClient, MutationCommandResult } from '@main/adb/adb-client'
import type { RawAdbDevice } from '@main/adb/device-list-parser'
import type { AdbAvailability } from '@shared/validation/device.schema'

/**
 * Implements the same AdbClient interface RealAdbClient does, so device
 * detection and the device registry can be tested without spawning any
 * process — this is the mock the project brief asks for explicitly, so
 * development and testing don't require a physical phone.
 */
export class FakeAdbClient implements AdbClient {
  availability: AdbAvailability = { available: true, version: '1.0.41-fake' }
  readonly deviceProperties = new Map<string, Map<string, string>>()
  /** Keyed by `${serial}\n${args.join(' ')}`. A string always returns that
   *  same value; an array is consumed one response per call (in order),
   *  repeating the last entry once exhausted — needed for tests where the
   *  same query (e.g. "is this package disabled?") is run both before and
   *  after a mutation and must reflect the state actually changing. */
  readonly shellResponses = new Map<string, string | string[]>()
  /** Keyed by `${serial}\n${args.join(' ')}`. */
  readonly mutationResponses = new Map<string, MutationCommandResult>()
  readonly mutationCalls: Array<{ serial: string; args: string[] }> = []
  /** Keyed by `${serial}\n${remotePath}`. Undefined means "succeed without
   *  writing a local file" — fine for tests that inject a fake extractor
   *  instead of touching the filesystem. Set to an Error to simulate a
   *  failed pull. */
  readonly pullResponses = new Map<string, Error | undefined>()
  readonly pullCalls: Array<{ serial: string; remotePath: string; localPath: string }> = []
  watchCallCount = 0
  /** Records every command the tested code switched to, for assertions. */
  adbCommandHistory: string[] = []

  private onUpdate: ((devices: RawAdbDevice[]) => void) | null = null
  private onError: ((error: Error) => void) | null = null

  getAvailability(): Promise<AdbAvailability> {
    return Promise.resolve(this.availability)
  }

  setAdbCommand(adbCommand: string): void {
    this.adbCommandHistory.push(adbCommand)
  }

  listDevicesOnce(): Promise<RawAdbDevice[]> {
    return Promise.resolve([])
  }

  getDeviceProperties(serial: string): Promise<Map<string, string>> {
    const properties = this.deviceProperties.get(serial)
    if (!properties) {
      return Promise.reject(new Error(`FakeAdbClient: no properties configured for ${serial}`))
    }
    return Promise.resolve(properties)
  }

  shellCommand(serial: string, args: string[]): Promise<string> {
    const key = `${serial}\n${args.join(' ')}`
    const response = this.shellResponses.get(key)
    if (response === undefined) {
      return Promise.reject(new Error(`FakeAdbClient: no shell response configured for "${key}"`))
    }
    if (Array.isArray(response)) {
      const next = response.length > 1 ? response.shift() : response[0]
      return Promise.resolve(next ?? '')
    }
    return Promise.resolve(response)
  }

  runMutationCommand(serial: string, args: string[]): Promise<MutationCommandResult> {
    this.mutationCalls.push({ serial, args })
    const key = `${serial}\n${args.join(' ')}`
    const response = this.mutationResponses.get(key)
    if (!response) {
      return Promise.reject(
        new Error(`FakeAdbClient: no mutation response configured for "${key}"`)
      )
    }
    return Promise.resolve(response)
  }

  pullFile(serial: string, remotePath: string, localPath: string): Promise<void> {
    this.pullCalls.push({ serial, remotePath, localPath })
    const key = `${serial}\n${remotePath}`
    const configuredError = this.pullResponses.get(key)
    if (configuredError) {
      return Promise.reject(configuredError)
    }
    return Promise.resolve()
  }

  /** Reuses the same mutationResponses/mutationCalls map as
   *  runMutationCommand, keyed by the equivalent argv (without -s
   *  <serial>) — install is just another mutating adb command. */
  installApk(serial: string, localApkPath: string): Promise<MutationCommandResult> {
    return this.runMutationCommand(serial, ['install', '-r', localApkPath])
  }

  /** Reuses the same mutationResponses/mutationCalls map, keyed by the
   *  equivalent argv — install-multiple is just another mutating adb
   *  command from this fake's point of view. */
  installMultipleApks(serial: string, apkPaths: string[]): Promise<MutationCommandResult> {
    return this.runMutationCommand(serial, ['install-multiple', '-r', ...apkPaths])
  }

  watchDevices(
    onUpdate: (devices: RawAdbDevice[]) => void,
    onError: (error: Error) => void
  ): () => void {
    this.watchCallCount += 1
    this.onUpdate = onUpdate
    this.onError = onError
    return () => {
      this.onUpdate = null
      this.onError = null
    }
  }

  /** Test helper: simulates a track-devices update reaching the registry. */
  emitSnapshot(devices: RawAdbDevice[]): void {
    this.onUpdate?.(devices)
  }

  /** Test helper: simulates the watch stream failing. */
  emitWatchError(error: Error): void {
    this.onError?.(error)
  }
}
