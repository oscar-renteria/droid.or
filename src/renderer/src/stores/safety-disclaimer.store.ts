import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSafetyDisclaimerStore = defineStore('safetyDisclaimer', () => {
  /** Null while unresolved (still checking, or genuinely never acknowledged).
   *  Distinguishing "still loading" from "not yet acknowledged" separately
   *  via `loading` avoids the disclaimer flashing on screen for a returning
   *  user before the initial check resolves. */
  const acknowledgedAt = ref<string | null>(null)
  const loading = ref(true)
  const errorMessage = ref<string | null>(null)

  async function check(): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      const status = await window.droidor?.getSafetyDisclaimerStatus()
      acknowledgedAt.value = status?.acknowledgedAt ?? null
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load.'
    } finally {
      loading.value = false
    }
  }

  async function acknowledge(): Promise<void> {
    const status = await window.droidor?.acknowledgeSafetyDisclaimer()
    acknowledgedAt.value = status?.acknowledgedAt ?? new Date().toISOString()
  }

  return { acknowledgedAt, loading, errorMessage, check, acknowledge }
})
