import { execFile, spawn } from 'node:child_process'
import type { AdbAvailability } from '@shared/validation/device.schema'
import { verifyAdb } from './adb-path'
import { parseDeviceListBody, type RawAdbDevice } from './device-list-parser'
import { parseGetprop } from './getprop-parser'
import { createTrackDevicesFrameSplitter } from './track-devices-frame-reader'

const EXEC_TIMEOUT_MS = 10_000

/**
 * Everything the rest of the app needs from ADB, kept narrow on purpose so a
 * FakeAdbClient (used in tests, and by anyone developing without a phone
 * attached) can implement it completely without reimplementing a process
 * manager.
 */
export interface AdbClient {
  getAvailability(): Promise<AdbAvailability>
  listDevicesOnce(): Promise<RawAdbDevice[]>
  getDeviceProperties(serial: string): Promise<Map<string, string>>
  /** Starts a persistent `adb track-devices` watch. Returns a function that
   *  stops it; safe to call more than once. */
  watchDevices(
    onUpdate: (devices: RawAdbDevice[]) => void,
    onError: (error: Error) => void
  ): () => void
}

export class RealAdbClient implements AdbClient {
  constructor(private readonly adbCommand: string) {}

  getAvailability(): Promise<AdbAvailability> {
    return verifyAdb(this.adbCommand)
  }

  listDevicesOnce(): Promise<RawAdbDevice[]> {
    return new Promise((resolve, reject) => {
      execFile(
        this.adbCommand,
        ['devices', '-l'],
        { timeout: EXEC_TIMEOUT_MS },
        (error, stdout) => {
          if (error) {
            reject(error)
            return
          }
          // The real header is "List of devices attached"; drop the first
          // line unconditionally rather than matching its exact text, so a
          // future adb wording change can't silently break parsing.
          const body = stdout.split('\n').slice(1).join('\n')
          resolve(parseDeviceListBody(body))
        }
      )
    })
  }

  getDeviceProperties(serial: string): Promise<Map<string, string>> {
    return new Promise((resolve, reject) => {
      execFile(
        this.adbCommand,
        ['-s', serial, 'shell', 'getprop'],
        { timeout: EXEC_TIMEOUT_MS },
        (error, stdout) => {
          if (error) {
            reject(error)
            return
          }
          resolve(parseGetprop(stdout))
        }
      )
    })
  }

  watchDevices(
    onUpdate: (devices: RawAdbDevice[]) => void,
    onError: (error: Error) => void
  ): () => void {
    const child = spawn(this.adbCommand, ['track-devices', '-l'])
    const feed = createTrackDevicesFrameSplitter((payload) => {
      onUpdate(parseDeviceListBody(payload))
    })

    child.stdout.on('data', feed)
    child.on('error', onError)
    child.on('exit', (code, signal) => {
      if (code !== 0 && signal === null) {
        onError(new Error(`adb track-devices exited unexpectedly with code ${code}`))
      }
    })

    let stopped = false
    return () => {
      if (stopped) {
        return
      }
      stopped = true
      child.stdout.removeListener('data', feed)
      child.removeAllListeners()
      child.kill()
    }
  }
}
