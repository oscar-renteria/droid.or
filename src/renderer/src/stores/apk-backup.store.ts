import type { PackageBackupResult } from '@shared/types/apk-backup'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useApkBackupStore = defineStore('apkBackup', () => {
  const busy = ref(false)
  const results = ref<PackageBackupResult[] | null>(null)
  const errorMessage = ref<string | null>(null)

  async function browseForDirectory(): Promise<string | null> {
    return (await window.droidor?.browseForBackupDirectory()) ?? null
  }

  async function backup(deviceId: string, packageNames: string[], destDir: string): Promise<void> {
    if (!window.droidor) {
      return
    }
    busy.value = true
    errorMessage.value = null
    results.value = null
    try {
      // Electron's ipcRenderer.invoke structured-clones its arguments, and
      // a Vue-reactive array (checked-row-keys from NDataTable, still a
      // reactive Proxy by the time it reaches here through props) doesn't
      // clone cleanly — verified directly: passing it as-is failed with a
      // bare "An object could not be cloned" and no further detail.
      // Spreading into a genuinely plain array fixes it.
      results.value = await window.droidor.backupPackages(deviceId, [...packageNames], destDir)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Backup failed.'
    } finally {
      busy.value = false
    }
  }

  function reset(): void {
    results.value = null
    errorMessage.value = null
  }

  return { busy, results, errorMessage, browseForDirectory, backup, reset }
})
