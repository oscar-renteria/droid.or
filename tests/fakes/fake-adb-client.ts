import type { AdbClient } from '@main/adb/adb-client'
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
  /** Keyed by `${serial}\n${args.join(' ')}`. */
  readonly shellResponses = new Map<string, string>()
  watchCallCount = 0

  private onUpdate: ((devices: RawAdbDevice[]) => void) | null = null
  private onError: ((error: Error) => void) | null = null

  getAvailability(): Promise<AdbAvailability> {
    return Promise.resolve(this.availability)
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
    return Promise.resolve(response)
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
