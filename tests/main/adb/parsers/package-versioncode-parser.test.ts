import { describe, expect, it } from 'vitest'
import { parsePackageVersionCodeList } from '@main/adb/parsers/package-versioncode-parser'

describe('parsePackageVersionCodeList', () => {
  it('parses one entry per line', () => {
    const output = 'package:com.example.a versionCode:12\npackage:com.example.b versionCode:340\n'
    expect(parsePackageVersionCodeList(output)).toEqual([
      { packageName: 'com.example.a', versionCode: 12 },
      { packageName: 'com.example.b', versionCode: 340 }
    ])
  })

  it('ignores blank lines and lines that do not match the expected shape', () => {
    const output = '\npackage:com.example.a versionCode:12\nsome unrelated line\n'
    expect(parsePackageVersionCodeList(output)).toEqual([
      { packageName: 'com.example.a', versionCode: 12 }
    ])
  })

  it('returns an empty list for empty output', () => {
    expect(parsePackageVersionCodeList('')).toEqual([])
  })
})
