import type { DeviceChanges } from '@shared/types/recovery'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useOperationsStore } from './operations.store'

export const useRecoveryStore = defineStore('recovery', () => {
  const changes = ref<DeviceChanges | null>(null)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)
  /** Set while a bulk (all/selected) restore is running — individual rows
   *  use operationsStore.pending for their own spinners. */
  const bulkRestoring = ref(false)

  async function load(deviceId: string): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      changes.value = (await window.droidor?.getDeviceChanges(deviceId)) ?? null
    } catch (error) {
      changes.value = null
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load device changes.'
    } finally {
      loading.value = false
    }
  }

  /**
   * Restores each given package in turn — one real ADB command at a time,
   * never concurrently, since these share the device's single USB
   * connection. Each one goes through the exact same verified pipeline
   * (performPackageOperation) as every other mutating action in this app.
   * Reloads the change list afterward so restored packages disappear from
   * it. Returns how many succeeded, for the caller to report.
   */
  async function restoreMany(
    deviceId: string,
    targets: Array<{ packageName: string; operation: 'enable' | 'restore-install' }>
  ): Promise<{ succeeded: number; failed: number }> {
    const operationsStore = useOperationsStore()
    bulkRestoring.value = true
    let succeeded = 0
    let failed = 0
    try {
      for (const target of targets) {
        const result = await operationsStore.performOperation(
          deviceId,
          target.packageName,
          target.operation
        )
        if (result?.success) {
          succeeded += 1
        } else {
          failed += 1
        }
      }
    } finally {
      bulkRestoring.value = false
    }
    await load(deviceId)
    return { succeeded, failed }
  }

  function reset(): void {
    changes.value = null
    errorMessage.value = null
  }

  return { changes, loading, errorMessage, bulkRestoring, load, restoreMany, reset }
})
