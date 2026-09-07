import { describe, expect, it } from 'vitest'
import {
  parsePackageListWithPathAndInstaller,
  parsePackageNameList
} from '@main/adb/parsers/package-list-parser'

describe('parsePackageListWithPathAndInstaller', () => {
  it('splits path from package name on the last "=", verified against a real device where the path itself contains "==" base64 padding', () => {
    const line =
      'package:/data/app/~~4_H8tYld6D1_axWyTpigyw==/com.blackberry.contacts-q66Jn_cprTK-g2K2nGuVWQ==/base.apk=com.blackberry.contacts  installer=com.android.vending'

    expect(parsePackageListWithPathAndInstaller(line)).toEqual([
      {
        packageName: 'com.blackberry.contacts',
        apkPath:
          '/data/app/~~4_H8tYld6D1_axWyTpigyw==/com.blackberry.contacts-q66Jn_cprTK-g2K2nGuVWQ==/base.apk',
        installerPackage: 'com.android.vending'
      }
    ])
  })

  it('maps the literal "null" installer to actual null (a real system app with no installer)', () => {
    const line = 'package:/product/app/Gmail2/Gmail2.apk=com.google.android.gm  installer=null'
    const result = parsePackageListWithPathAndInstaller(line)
    expect(result[0]?.installerPackage).toBeNull()
    expect(result[0]?.packageName).toBe('com.google.android.gm')
  })

  it('parses multiple lines and ignores non-package lines', () => {
    const output = [
      '',
      'package:/system/app/A/a.apk=com.a  installer=null',
      'package:/system/app/B/b.apk=com.b  installer=com.android.vending'
    ].join('\n')
    expect(parsePackageListWithPathAndInstaller(output)).toHaveLength(2)
  })
})

describe('parsePackageNameList', () => {
  it('parses plain package: lines with no path or installer', () => {
    const output = ['package:com.a', 'package:com.b'].join('\n')
    expect(parsePackageNameList(output)).toEqual(['com.a', 'com.b'])
  })

  it('returns an empty array for empty output', () => {
    expect(parsePackageNameList('')).toEqual([])
  })
})
