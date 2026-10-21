import type { OperationResult } from '@shared/types/operation'
import type { SplitInstallAnalysis } from '@shared/types/split-install'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useDeviceTransferStore = defineStore('deviceTransfer', () => {
  const analysis = ref<SplitInstallAnalysis | null>(null)
  /** Which transfer `analysis` describes. confirm() only ever acts on this
   *  exact source/target/package, so a target picked after the check can
   *  never be installed onto with another device's compatibility result. */
  const analyzedSourceId = ref<string | null>(null)
  const analyzedTargetId = ref<string | null>(null)
  const analyzedPackageName = ref<string | null>(null)

  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  const installing = ref(false)
  const result = ref<OperationResult | null>(null)

  const busy = computed(() => loading.value || installing.value)

  /** Bumped by reset(), so a request that resolves after its state was
   *  thrown away can't write into (or un-busy) whatever came next. */
  let generation = 0

  function reset(): void {
    generation += 1
    analysis.value = null
    analyzedSourceId.value = null
    analyzedTargetId.value = null
    analyzedPackageName.value = null
    loading.value = false
    errorMessage.value = null
    installing.value = false
    result.value = null
  }

  async function analyze(
    sourceDeviceId: string,
    targetDeviceId: string,
    packageName: string
  ): Promise<void> {
    if (!window.droidor) {
      return
    }
    reset()
    const requestGeneration = generation
    loading.value = true
    try {
      const response = await window.droidor.analyzeDeviceTransfer(
        sourceDeviceId,
        targetDeviceId,
        packageName
      )
      if (requestGeneration !== generation) {
        return
      }
      analysis.value = response
      analyzedSourceId.value = sourceDeviceId
      analyzedTargetId.value = targetDeviceId
      analyzedPackageName.value = packageName
    } catch (error) {
      if (requestGeneration === generation) {
        errorMessage.value =
          error instanceof Error ? error.message : 'Failed to copy this app from the source device.'
      }
    } finally {
      if (requestGeneration === generation) {
        loading.value = false
      }
    }
  }

  async function confirm(): Promise<void> {
    if (
      !window.droidor ||
      !analysis.value?.canInstall ||
      analyzedSourceId.value === null ||
      analyzedTargetId.value === null ||
      analyzedPackageName.value === null
    ) {
      return
    }
    const requestGeneration = generation
    installing.value = true
    result.value = null
    let outcome: OperationResult
    try {
      outcome = await window.droidor.performDeviceTransfer(
        analyzedSourceId.value,
        analyzedTargetId.value,
        analyzedPackageName.value,
        analysis.value.versionCode
      )
    } catch (error) {
      outcome = {
        success: false,
        message: error instanceof Error ? error.message : 'Copy failed.',
        rawOutput: ''
      }
    }
    if (requestGeneration === generation) {
      result.value = outcome
      installing.value = false
    }
  }

  return {
    analysis,
    analyzedSourceId,
    analyzedTargetId,
    analyzedPackageName,
    loading,
    errorMessage,
    installing,
    result,
    busy,
    reset,
    analyze,
    confirm
  }
})
