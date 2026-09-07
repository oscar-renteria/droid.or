const PLAY_STORE_INSTALLER = 'com.android.vending'

export function formatInstallSource(installerPackage: string | null): string {
  if (installerPackage === null) {
    return 'Unknown / sideloaded'
  }
  return installerPackage === PLAY_STORE_INSTALLER ? 'Play Store' : installerPackage
}

export function isFromPlayStore(installerPackage: string | null): boolean {
  return installerPackage === PLAY_STORE_INSTALLER
}

export function formatInstalledDate(ms: number | null): string {
  if (ms === null) {
    return 'Unknown'
  }
  return new Date(ms).toLocaleDateString()
}

export function formatVersion(versionName: string | null, versionCode: number | null): string {
  if (versionName === null && versionCode === null) {
    return 'Not available'
  }
  if (versionName !== null && versionCode !== null) {
    return `${versionName} (${versionCode})`
  }
  return versionName ?? `Version code ${versionCode}`
}
