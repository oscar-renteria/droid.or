import type { AdbStatus } from '@shared/types/adb-settings'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAdbSettingsStore = defineStore('adbSettings', () => {
  const status = ref<AdbStatus | null>(null)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  /** True while a path is being validated, or a platform-tools download is
   *  in progress — both are real device/network waits, not instant. */
  const busy = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      status.value = (await window.droidor?.getAdbStatus()) ?? null
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load ADB status.'
    } finally {
      loading.value = false
    }
  }

  async function setCustomPath(path: string | null): Promise<boolean> {
    if (!window.droidor) {
      return false
    }
    busy.value = true
    errorMessage.value = null
    try {
      status.value = await window.droidor.setCustomAdbPath(path)
      return true
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to set the ADB path.'
      return false
    } finally {
      busy.value = false
    }
  }

  async function downloadPlatformTools(): Promise<boolean> {
    if (!window.droidor) {
      return false
    }
    busy.value = true
    errorMessage.value = null
    try {
      status.value = await window.droidor.downloadPlatformTools()
      return true
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Failed to download platform-tools.'
      return false
    } finally {
      busy.value = false
    }
  }

  async function browseForExecutable(): Promise<string | null> {
    return (await window.droidor?.browseForAdbExecutable()) ?? null
  }

  return {
    status,
    loading,
    errorMessage,
    busy,
    load,
    setCustomPath,
    downloadPlatformTools,
    browseForExecutable
  }
})
