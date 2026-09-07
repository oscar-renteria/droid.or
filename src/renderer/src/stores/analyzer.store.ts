import type { AnalyzeDeviceResult } from '@shared/types/analyzer'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAnalyzerStore = defineStore('analyzer', () => {
  const result = ref<AnalyzeDeviceResult | null>(null)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  async function analyze(deviceId: string): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      result.value = (await window.droidor?.analyzeDevice(deviceId)) ?? null
    } catch (error) {
      result.value = null
      errorMessage.value = error instanceof Error ? error.message : 'Failed to analyze device.'
    } finally {
      loading.value = false
    }
  }

  async function setIgnored(packageName: string, ignored: boolean): Promise<void> {
    await window.droidor?.setPackageIgnored(packageName, ignored)
    const recommendation = result.value?.recommendations.find((r) => r.packageName === packageName)
    if (recommendation) {
      recommendation.isIgnored = ignored
      if (result.value) {
        result.value.summary.ignored += ignored ? 1 : -1
      }
    }
  }

  function reset(): void {
    result.value = null
    errorMessage.value = null
  }

  return { result, loading, errorMessage, analyze, setIgnored, reset }
})
