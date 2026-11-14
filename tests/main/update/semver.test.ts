import { describe, expect, it } from 'vitest'
import { compareVersions, parseVersion } from '@main/update/semver'

describe('parseVersion', () => {
  it('accepts versions with and without a leading v', () => {
    expect(parseVersion('v1.2.3')).toEqual({ core: [1, 2, 3], prerelease: [] })
    expect(parseVersion('1.0.0-beta.1')).toEqual({ core: [1, 0, 0], prerelease: ['beta', '1'] })
  })

  it('rejects anything that is not MAJOR.MINOR.PATCH', () => {
    for (const raw of ['1.2', 'latest', '1.2.3.4', '', 'v1.2.x']) {
      expect(parseVersion(raw)).toBeNull()
    }
  })
})

describe('compareVersions', () => {
  it.each([
    ['1.0.1', '1.0.0', 1],
    ['1.1.0', '1.0.9', 1],
    ['2.0.0', '1.99.99', 1],
    ['1.0.0', '1.0.0', 0],
    ['v1.0.0', '1.0.0', 0],
    ['1.0.0', '1.0.0-rc.1', 1],
    ['1.0.0-rc.1', '1.0.0-beta.2', 1],
    ['1.0.0-beta.10', '1.0.0-beta.2', 1],
    ['1.0.0-beta.1', '1.0.0-beta', 1],
    ['1.0.0-alpha.beta', '1.0.0-alpha.1', 1]
  ])('%s vs %s → %i', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected)
    expect(compareVersions(b, a)).toBe(-expected || 0)
  })

  it('throws on a malformed version instead of guessing', () => {
    expect(() => compareVersions('1.0.0', 'nightly')).toThrow('Not a SemVer version: "nightly"')
  })
})
