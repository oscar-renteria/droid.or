import type { SplitSourceKind } from '@shared/types/split-install'

export type InstallFileRoute =
  | { tab: 'single'; paths: string[] }
  | { tab: 'split'; sourceKind: SplitSourceKind; paths: string[] }

const APK_EXTENSION = /\.apk$/i
const ARCHIVE_EXTENSION = /\.(apks|xapk|apkm)$/i

export function routeInstallFilePaths(paths: string[]): InstallFileRoute | null {
  if (paths.length === 0) {
    return null
  }

  if (paths.length === 1) {
    const [path] = paths
    if (path === undefined) {
      return null
    }
    if (APK_EXTENSION.test(path)) {
      return { tab: 'single', paths }
    }
    if (ARCHIVE_EXTENSION.test(path)) {
      return { tab: 'split', sourceKind: 'archive', paths }
    }

    // Drag-and-drop does not expose a reliable directory flag, so keep the
    // existing single-path fallback to split-directory analysis.
    return { tab: 'split', sourceKind: 'directory', paths }
  }

  if (paths.every((path) => APK_EXTENSION.test(path))) {
    return { tab: 'split', sourceKind: 'files', paths }
  }

  return null
}
