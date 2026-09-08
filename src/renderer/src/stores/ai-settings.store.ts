import type { AiProviderId, AiSettings } from '@shared/types/ai-settings'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAiSettingsStore = defineStore('aiSettings', () => {
  const settings = ref<AiSettings | null>(null)
  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  async function load(): Promise<void> {
    loading.value = true
    errorMessage.value = null
    try {
      settings.value = (await window.droidor?.getAiSettings()) ?? null
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load AI settings.'
    } finally {
      loading.value = false
    }
  }

  /** Returns whether the save succeeded — callers show their own success
   *  toast on true, and rely on errorMessage being set on false. */
  async function save(update: {
    provider: AiProviderId | null
    model: string | null
    baseUrl: string | null
    apiKey?: string | null | undefined
  }): Promise<boolean> {
    errorMessage.value = null
    try {
      settings.value = (await window.droidor?.setAiSettings(update)) ?? null
      return true
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to save AI settings.'
      return false
    }
  }

  return { settings, loading, errorMessage, load, save }
})
