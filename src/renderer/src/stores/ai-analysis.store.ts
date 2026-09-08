import type { AiAnalysisResult } from '@shared/types/ai-settings'
import { defineStore } from 'pinia'
import { ref } from 'vue'

interface AnalysisState {
  result: AiAnalysisResult | null
  loading: boolean
  errorMessage: string | null
}

const EMPTY_STATE: AnalysisState = { result: null, loading: false, errorMessage: null }

/** Keyed by package name, since more than one package's result may be
 *  worth keeping around in the same session — mirrors the metadataCache
 *  pattern in packages.store.ts. */
export const useAiAnalysisStore = defineStore('aiAnalysis', () => {
  const byPackage = ref(new Map<string, AnalysisState>())

  function stateFor(packageName: string): AnalysisState {
    return byPackage.value.get(packageName) ?? EMPTY_STATE
  }

  async function analyze(
    deviceId: string,
    packageName: string,
    displayName: string | null,
    versionName: string | null,
    isSystemApp: boolean
  ): Promise<void> {
    byPackage.value.set(packageName, { result: null, loading: true, errorMessage: null })
    try {
      const result = await window.droidor?.analyzePackageWithAi({
        deviceId,
        packageName,
        displayName,
        versionName,
        isSystemApp
      })
      byPackage.value.set(packageName, {
        result: result ?? null,
        loading: false,
        errorMessage: null
      })
    } catch (error) {
      byPackage.value.set(packageName, {
        result: null,
        loading: false,
        errorMessage: error instanceof Error ? error.message : 'AI analysis failed.'
      })
    }
  }

  return { byPackage, stateFor, analyze }
})
