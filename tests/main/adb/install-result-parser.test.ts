import { describe, expect, it } from 'vitest'
import { extractInstallFailureMessage, isInstallSuccessful } from '@main/adb/install-result-parser'

describe('isInstallSuccessful', () => {
  it('is true for a zero exit code with a bare Success line', () => {
    expect(isInstallSuccessful(0, 'Performing Streamed Install\nSuccess\n')).toBe(true)
  })

  it('is true for a zero exit code with just Success', () => {
    expect(isInstallSuccessful(0, 'Success')).toBe(true)
  })

  it('is false for a non-zero exit code even if stdout says Success somewhere', () => {
    expect(isInstallSuccessful(1, 'Success')).toBe(false)
  })

  it('is false for a zero exit code with no Success line', () => {
    expect(isInstallSuccessful(0, 'Performing Streamed Install\n')).toBe(false)
  })
})

describe('extractInstallFailureMessage', () => {
  it('extracts a bracketed Failure reason', () => {
    const stdout = 'Performing Streamed Install\nFailure [INSTALL_FAILED_VERSION_DOWNGRADE]\n'
    expect(extractInstallFailureMessage(stdout, '')).toBe('INSTALL_FAILED_VERSION_DOWNGRADE')
  })

  it('extracts the reason from an "adb: failed to install" wrapper', () => {
    const stderr =
      'adb: failed to install /tmp/app.apk: Failure [INSTALL_FAILED_INVALID_APK: could not parse]'
    // The bracketed-Failure pattern matches first, since it's the more
    // specific, more informative reason when both are present.
    expect(extractInstallFailureMessage('', stderr)).toBe(
      'INSTALL_FAILED_INVALID_APK: could not parse'
    )
  })

  it('extracts the reason from a plain "adb: failed to install" wrapper with no brackets', () => {
    const stderr = 'adb: failed to install /tmp/app.apk: device offline'
    expect(extractInstallFailureMessage('', stderr)).toBe('device offline')
  })

  it('gives a specific message for a host-side "failed to stat" error', () => {
    const stderr = 'adb: failed to stat /tmp/missing.apk: No such file or directory'
    expect(extractInstallFailureMessage('', stderr)).toBe(
      'File not accessible: No such file or directory'
    )
  })

  it('falls back to the first non-empty line for an unrecognized format', () => {
    expect(extractInstallFailureMessage('Something went wrong\nmore detail', '')).toBe(
      'Something went wrong'
    )
  })

  it('falls back to a generic message when there is no output at all', () => {
    expect(extractInstallFailureMessage('', '')).toBe('The install failed for an unknown reason.')
  })
})
