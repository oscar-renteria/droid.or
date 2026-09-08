import type { MutatingOperationType } from '@shared/types/operation'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useOperationsStore } from './operations.store'

export interface ProfileApplyResult {
  success: boolean
  message: string
}

export const useDebloatProfilesStore = defineStore('debloatProfiles', () => {
  const applying = ref(false)
  const results = ref(new Map<string, ProfileApplyResult>())

  /** Sequential, never concurrent — same rule as every other bulk action
   *  in this app, since these share the device's single USB connection.
   *  Reuses operationsStore.performOperation for each package, so every
   *  application still goes through the same verified pipeline (state
   *  re-check, history logging) as a single manual action. */
  async function applyToPackages(
    deviceId: string,
    packageNames: string[],
    operation: MutatingOperationType
  ): Promise<{ succeeded: number; failed: number }> {
    const operationsStore = useOperationsStore()
    applying.value = true
    results.value = new Map()
    let succeeded = 0
    let failed = 0
    try {
      for (const packageName of packageNames) {
        const result = await operationsStore.performOperation(deviceId, packageName, operation)
        if (result?.success) {
          succeeded += 1
        } else {
          failed += 1
        }
        results.value.set(packageName, {
          success: result?.success ?? false,
          message: result?.message ?? 'This operation could not be completed.'
        })
      }
    } finally {
      applying.value = false
    }
    return { succeeded, failed }
  }

  function reset(): void {
    results.value = new Map()
  }

  return { applying, results, applyToPackages, reset }
})
