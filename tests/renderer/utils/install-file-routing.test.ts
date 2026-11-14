import { describe, expect, it } from 'vitest'
import { routeInstallFilePaths } from '@renderer/utils/install-file-routing'

describe('routeInstallFilePaths', () => {
  it('routes a single APK to the single-install flow', () => {
    expect(routeInstallFilePaths(['/packages/app.apk'])).toEqual({
      tab: 'single',
      paths: ['/packages/app.apk']
    })
  })

  it.each(['bundle.apks', 'bundle.xapk', 'bundle.apkm', 'BUNDLE.XAPK'])(
    'routes %s to archive analysis',
    (path) => {
      expect(routeInstallFilePaths([path])).toEqual({
        tab: 'split',
        sourceKind: 'archive',
        paths: [path]
      })
    }
  )

  it('routes multiple APK files to split analysis', () => {
    const paths = ['/packages/base.apk', '/packages/config.arm64.apk']
    expect(routeInstallFilePaths(paths)).toEqual({
      tab: 'split',
      sourceKind: 'files',
      paths
    })
  })

  it('keeps a single extensionless path as a split-directory source', () => {
    expect(routeInstallFilePaths(['/packages/split-set'])).toEqual({
      tab: 'split',
      sourceKind: 'directory',
      paths: ['/packages/split-set']
    })
  })

  it('rejects empty and mixed-source drops', () => {
    expect(routeInstallFilePaths([])).toBeNull()
    expect(routeInstallFilePaths(['/packages/app.apk', '/packages/bundle.apks'])).toBeNull()
  })
})
