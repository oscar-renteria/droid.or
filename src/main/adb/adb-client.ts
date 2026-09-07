import { execFile, spawn } from 'node:child_process'
import type { AdbAvailability } from '@shared/validation/device.schema'
import { verifyAdb } from './adb-path'
import { parseDeviceListBody, type RawAdbDevice } from './device-list-parser'
import { parseGetprop } from './getprop-parser'
import { createTrackDevicesFrameSplitter } from './track-devices-frame-reader'

const EXEC_TIMEOUT_MS = 10_000
const SHELL_COMMAND_TIMEOUT_MS = 30_000
const PULL_TIMEOUT_MS = 120_000

export interface MutationCommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

/**
 * Everything the rest of the app needs from ADB, kept narrow on purpose so a
 * FakeAdbClient (used in tests, and by anyone developing without a phone
 * attached) can implement it completely without reimplementing a process
 * manager.
 */
export interface AdbClient {
  getAvailability(): Promise<AdbAvailability>
  /** Changes which adb executable every subsequent call uses — e.g. after
   *  the user sets a custom path or a managed platform-tools download
   *  completes. Takes effect immediately for one-shot commands; a
   *  long-running watch (track-devices) started before this call keeps
   *  using the old binary until it's restarted. */
  setAdbCommand(adbCommand: string): void
  listDevicesOnce(): Promise<RawAdbDevice[]>
  getDeviceProperties(serial: string): Promise<Map<string, string>>
  /** Runs one predefined, hard-coded shell command against a device and
   *  returns its raw stdout. `args` is always a fixed argv array chosen by
   *  the caller in source code — never built from renderer/user input — so
   *  this stays within "predefined ADB operations only", not a general
   *  shell escape hatch. */
  shellCommand(serial: string, args: string[]): Promise<string>
  /** Like shellCommand, but for predefined *mutating* operations: resolves
   *  with the exit code and both stdout/stderr regardless of whether the
   *  command reported success or failure (only rejects for a real spawn
   *  failure, e.g. adb itself missing). Verified against a real device that
   *  this matters: `pm uninstall` writes its failure text to stdout while
   *  `pm disable-user`/`pm enable` write theirs to stderr as a raw Java
   *  exception dump, and plain execFile-style rejection on a non-zero exit
   *  discards that text — which is exactly the diagnostic a user needs to
   *  see when an operation fails. */
  runMutationCommand(serial: string, args: string[]): Promise<MutationCommandResult>
  /** Copies one file from the device to a local path (e.g. an APK, to
   *  extract its label/icon locally — nothing about this reads from or
   *  writes to arbitrary device paths chosen by the renderer). */
  pullFile(serial: string, remotePath: string, localPath: string): Promise<void>
  /** Starts a persistent `adb track-devices` watch. Returns a function that
   *  stops it; safe to call more than once. */
  watchDevices(
    onUpdate: (devices: RawAdbDevice[]) => void,
    onError: (error: Error) => void
  ): () => void
}

export class RealAdbClient implements AdbClient {
  constructor(private adbCommand: string) {}

  setAdbCommand(adbCommand: string): void {
    this.adbCommand = adbCommand
  }

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

  shellCommand(serial: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.adbCommand,
        ['-s', serial, 'shell', ...args],
        // A bulk `dumpsys package packages` on a heavily bloated device can
        // run past ten seconds and several megabytes of output (a real
        // 595-package device produced ~3MB), well beyond a typical
        // one-line shell command.
        { timeout: SHELL_COMMAND_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            reject(error)
            return
          }
          resolve(stdout)
        }
      )
    })
  }

  runMutationCommand(serial: string, args: string[]): Promise<MutationCommandResult> {
    return new Promise((resolve, reject) => {
      execFile(
        this.adbCommand,
        ['-s', serial, 'shell', ...args],
        { timeout: SHELL_COMMAND_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error && typeof error.code !== 'number') {
            // Not a command exit code — adb itself failed to spawn/run.
            reject(error)
            return
          }
          resolve({ exitCode: typeof error?.code === 'number' ? error.code : 0, stdout, stderr })
        }
      )
    })
  }

  pullFile(serial: string, remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        this.adbCommand,
        ['-s', serial, 'pull', remotePath, localPath],
        { timeout: PULL_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
        (error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
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
