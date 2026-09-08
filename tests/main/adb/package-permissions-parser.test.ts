import { describe, expect, it } from 'vitest'
import { parsePackageRequestedPermissions } from '@main/adb/parsers/package-permissions-parser'

describe('parsePackageRequestedPermissions', () => {
  it('extracts the requested permissions list for the given package', () => {
    const output = [
      'Packages:',
      '  Package [com.google.android.gm] (e10b8fa):',
      '    userId=10123',
      '    requested permissions:',
      '      android.permission.INTERNET',
      '      android.permission.READ_CONTACTS',
      '      android.permission.WRITE_EXTERNAL_STORAGE: restricted=true',
      '    install permissions:',
      '      android.permission.INTERNET: granted=true',
      '  Package [com.google.android.gm] (a2f2fe):',
      '    requested permissions:',
      '      android.permission.OTHER_SIBLING',
      '    install permissions:'
    ].join('\n')

    expect(parsePackageRequestedPermissions(output, 'com.google.android.gm')).toEqual([
      'android.permission.INTERNET',
      'android.permission.READ_CONTACTS',
      'android.permission.WRITE_EXTERNAL_STORAGE'
    ])
  })

  it('stops at the next section, not spilling into unrelated content', () => {
    const output = [
      '  Package [com.example.app] (abc123):',
      '    requested permissions:',
      '      android.permission.VIBRATE',
      '    declared permissions:',
      '      com.example.app.permission.CUSTOM: prot=signature'
    ].join('\n')

    expect(parsePackageRequestedPermissions(output, 'com.example.app')).toEqual([
      'android.permission.VIBRATE'
    ])
  })

  it('returns an empty array when the package header is not found', () => {
    const output =
      '  Package [com.other.app] (abc123):\n    requested permissions:\n      android.permission.VIBRATE'
    expect(parsePackageRequestedPermissions(output, 'com.example.app')).toEqual([])
  })

  it('returns an empty array when the package has no requested permissions section', () => {
    const output = '  Package [com.example.app] (abc123):\n    install permissions:\n'
    expect(parsePackageRequestedPermissions(output, 'com.example.app')).toEqual([])
  })

  it('does not treat a regex-special character in the package name as a pattern', () => {
    // A package name can't actually contain regex metacharacters in
    // practice, but the lookup must not throw or misbehave if it did.
    expect(() => parsePackageRequestedPermissions('', 'com.example.app+test')).not.toThrow()
  })
})
