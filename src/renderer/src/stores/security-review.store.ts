import type { SecurityReviewResult } from '@shared/types/security-review'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSecurityReviewStore = defineStore('securityReview', () => {
  const result = ref<SecurityReviewResult | null>(null)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  async function review(deviceId: string): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      result.value = (await window.droidor?.getSecurityReview(deviceId)) ?? null
    } catch (error) {
      result.value = null
      errorMessage.value =
        error instanceof Error ? error.message : 'Failed to run the security review.'
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    result.value = null
    errorMessage.value = null
  }

  return { result, loading, errorMessage, review, reset }
})
