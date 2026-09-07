import { describe, expect, it } from 'vitest'
import { extractFailureMessage } from '@main/adb/mutation-result-parser'

describe('extractFailureMessage', () => {
  it('extracts the exception message from a real `pm disable-user` failure (stderr)', () => {
    // Captured verbatim against a real device using a nonexistent package
    // name, so nothing real was ever modified.
    const stderr = `
Exception occurred while executing 'disable-user':
java.lang.IllegalArgumentException: Unknown package: com.droidor.verification.nonexistent.test
	at com.android.server.pm.PackageManagerService.setApplicationEnabledSetting(...)
	at com.android.server.pm.PackageManagerShellCommand.runSetEnabledSetting(...)`
    expect(extractFailureMessage('', stderr)).toBe(
      'java.lang.IllegalArgumentException: Unknown package: com.droidor.verification.nonexistent.test'
    )
  })

  it('extracts the reason from a real `pm uninstall` failure (stdout)', () => {
    expect(extractFailureMessage('Failure [not installed for 0]\n', '')).toBe('not installed for 0')
  })

  it('gives a generic message for a real `pm clear` failure, which carries no reason at all', () => {
    expect(extractFailureMessage('Failed\n', '')).toBe(
      'The device reported that this operation failed, without giving a specific reason.'
    )
  })

  it('falls back to the first non-empty line for a completely unrecognized format', () => {
    expect(extractFailureMessage('some unexpected output\nmore text', '')).toBe(
      'some unexpected output'
    )
  })

  it('returns a generic message for empty output', () => {
    expect(extractFailureMessage('', '')).toBe('The operation failed for an unknown reason.')
  })
})
