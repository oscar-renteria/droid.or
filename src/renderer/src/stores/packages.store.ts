import type { AppPackageInfo } from '@shared/types/package'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePackagesStore = defineStore('packages', () => {
  const packages = ref<AppPackageInfo[]>([])
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  const loadedForDeviceId = ref<string | null>(null)

  async function fetchPackages(deviceId: string): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      packages.value = (await window.droidor?.getPackages(deviceId)) ?? []
      loadedForDeviceId.value = deviceId
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
  }

  return { packages, loading, errorMessage, loadedForDeviceId, fetchPackages, reset }
})
