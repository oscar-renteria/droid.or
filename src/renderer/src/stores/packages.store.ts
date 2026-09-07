import type { AppMetadataResult, AppPackageInfo } from '@shared/types/package'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePackagesStore = defineStore('packages', () => {
  const packages = ref<AppPackageInfo[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const loadedForDeviceId = ref<string | null>(null)
  /** Real (APK-parsed) label/icon per package, filled in lazily and on
   *  demand — never fetched for all packages up front, since each entry
   *  costs a real device transfer. 'loading' while a fetch is in flight. */
  const metadataCache = ref(new Map<string, AppMetadataResult | 'loading'>())

  async function fetchPackages(deviceId: string): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      packages.value = (await window.droidor?.getPackages(deviceId)) ?? []
      loadedForDeviceId.value = deviceId
      metadataCache.value = new Map()
    } catch (error) {
      packages.value = []
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load packages.'
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    packages.value = []
    errorMessage.value = null
    loadedForDeviceId.value = null
    metadataCache.value = new Map()
  }

  /** Fire-and-forget: queues a real label/icon fetch for one package unless
   *  it's already cached or in flight. The main process itself limits how
   *  many of these run at once, so callers don't need to throttle. */
  function fetchMetadata(deviceId: string, pkg: AppPackageInfo): void {
    if (!pkg.apkPath || metadataCache.value.has(pkg.packageName) || !window.droidor) {
      return
    }
    metadataCache.value.set(pkg.packageName, 'loading')
    window.droidor
      .getAppMetadata({
        deviceId,
        packageName: pkg.packageName,
        apkPath: pkg.apkPath,
        versionCode: pkg.versionCode
      })
      .then((result) => {
        metadataCache.value.set(pkg.packageName, result)
      })
      .catch(() => {
        metadataCache.value.set(pkg.packageName, { label: null, iconDataUrl: null })
      })
  }

  return {
    packages,
    loading,
    errorMessage,
    loadedForDeviceId,
    metadataCache,
    fetchPackages,
    reset,
    fetchMetadata
  }
})
