import type { OperationHistoryEntry, OperationResult, OperationType } from '@shared/types/operation'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useOperationsStore = defineStore('operations', () => {
  /** Package names with an operation currently in flight — lets any view
   *  disable that row's buttons and show a spinner without a separate
   *  per-view loading flag. */
  const pending = ref(new Set<string>())
  const history = ref<OperationHistoryEntry[]>([])
  const historyLoading = ref(false)
  const historyError = ref<string | null>(null)

  async function performOperation(
    deviceId: string,
    packageName: string,
    operation: OperationType
  ): Promise<OperationResult | null> {
    if (!window.droidor) {
      return null
    }
    pending.value.add(packageName)
    try {
      return await window.droidor.performOperation(deviceId, packageName, operation)
    } finally {
      pending.value.delete(packageName)
    }
  }

  async function loadHistory(deviceId: string): Promise<void> {
    historyLoading.value = true
    historyError.value = null
    try {
      history.value = (await window.droidor?.getOperationHistory(deviceId)) ?? []
    } catch (error) {
      history.value = []
      historyError.value = error instanceof Error ? error.message : 'Failed to load history.'
    } finally {
      historyLoading.value = false
    }
  }

  function reset(): void {
    history.value = []
    historyError.value = null
  }

  return { pending, history, historyLoading, historyError, performOperation, loadHistory, reset }
})
