import { execFile } from 'node:child_process'
import type { AdbAvailability } from '@shared/validation/device.schema'

const VERIFY_TIMEOUT_MS = 5000

/**
 * Resolves which adb executable to invoke. For now this is just an optional
 * user-configured override falling back to plain "adb" (resolved via PATH by
 * the OS, the same way execFile/spawn always resolve a bare command name) —
 * bundling platform-tools into the app is a packaging-milestone concern, not
 * a transport-layer one, and would slot in here as another fallback later.
 */
export function resolveAdbCommand(configuredPath?: string | null): string {
  return configuredPath && configuredPath.trim().length > 0 ? configuredPath : 'adb'
}

/**
 * Confirms the resolved adb command actually exists and runs, and reports
 * its version. Never throws: every failure mode (not found, not executable,
 * unparsable output, timeout) becomes an { available: false, reason }
 * result, since "adb missing or broken" is expected, recoverable app state,
 * not an exceptional one.
 */
export function verifyAdb(adbCommand: string): Promise<AdbAvailability> {
  return new Promise((resolve) => {
    execFile(adbCommand, ['version'], { timeout: VERIFY_TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        const reason =
          'code' in error && error.code === 'ENOENT'
            ? `"${adbCommand}" was not found. Install Android platform-tools or configure a custom ADB path in Settings.`
            : `"${adbCommand}" did not run successfully: ${error.message}`
        resolve({ available: false, reason })
        return
      }

      const versionMatch = /Android Debug Bridge version ([\d.]+)/.exec(stdout)
      if (!versionMatch?.[1]) {
        resolve({
          available: false,
          reason: `"${adbCommand}" ran but its output could not be recognized as ADB.`
        })
        return
      }

      resolve({ available: true, version: versionMatch[1] })
    })
  })
}
