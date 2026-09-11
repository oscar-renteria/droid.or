import type { OperationResult } from '@shared/types/operation'
import type { SplitInstallAnalysis, SplitSourceKind } from '@shared/types/split-install'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { computeDefaultSelectedFileNames } from '@renderer/utils/split-install-default-selection'

export const useSplitInstallStore = defineStore('splitInstall', () => {
  const sourceKind = ref<SplitSourceKind | null>(null)
  const sourcePaths = ref<string[]>([])
  const analysis = ref<SplitInstallAnalysis | null>(null)
  /** File names of every non-base part currently checked for install — the
   *  base part is always installed regardless of whether it's in this set,
   *  matching what the main process itself enforces. */
  const selectedFileNames = ref<Set<string>>(new Set())
  /** The device id `analysis` was computed for — lets the panel component
   *  notice when the sidebar's selected device has since changed (or
   *  changed and changed back through an in-between "no device" state)
   *  and re-analyze rather than silently showing one device's
   *  compatibility/plan info while installing onto another. */
  const analyzedDeviceId = ref<string | null>(null)

  const loading = ref(false)
  const errorMessage = ref<string | null>(null)

  const installing = ref(false)
  const installResult = ref<OperationResult | null>(null)

  function reset(): void {
    sourceKind.value = null
    sourcePaths.value = []
    analysis.value = null
    selectedFileNames.value = new Set()
    analyzedDeviceId.value = null
    loading.value = false
    errorMessage.value = null
    installing.value = false
    installResult.value = null
  }

  /** Analyzes a new source and, on success, pre-selects the parts the
   *  device would actually use — every device-compatible language/unknown
   *  part, but only the one ABI split and one density split matching the
   *  device's own preference (see computeDefaultSelectedFileNames) rather
   *  than every compatible one, which would otherwise redundantly
   *  pre-check e.g. both 64-bit and 32-bit native-library splits at once. */
  async function analyzeSource(
    deviceId: string,
    kind: SplitSourceKind,
    paths: string[]
  ): Promise<void> {
    if (!window.droidor) {
      return
    }
    sourceKind.value = kind
    sourcePaths.value = paths
    analysis.value = null
    installResult.value = null
    loading.value = true
    errorMessage.value = null
    try {
      const result = await window.droidor.analyzeSplitInstallSource(deviceId, kind, paths)
      analysis.value = result
      analyzedDeviceId.value = deviceId
      selectedFileNames.value = computeDefaultSelectedFileNames(result)
    } catch (error) {
      analysis.value = null
      errorMessage.value = error instanceof Error ? error.message : 'Failed to read this source.'
    } finally {
      loading.value = false
    }
  }

  function toggleFileName(fileName: string): void {
    const next = new Set(selectedFileNames.value)
    if (next.has(fileName)) {
      next.delete(fileName)
    } else {
      next.add(fileName)
    }
    selectedFileNames.value = next
  }

  async function confirmInstall(deviceId: string): Promise<void> {
    if (!window.droidor || sourceKind.value === null || !analysis.value?.canInstall) {
      return
    }
    installing.value = true
    installResult.value = null
    try {
      installResult.value = await window.droidor.installSplitApks(
        deviceId,
        sourceKind.value,
        sourcePaths.value,
        [...selectedFileNames.value]
      )
    } catch (error) {
      installResult.value = {
        success: false,
        message: error instanceof Error ? error.message : 'Install failed.',
        rawOutput: ''
      }
    } finally {
      installing.value = false
    }
  }

  return {
    sourceKind,
    sourcePaths,
    analysis,
    selectedFileNames,
    analyzedDeviceId,
    loading,
    errorMessage,
    installing,
    installResult,
    reset,
    analyzeSource,
    toggleFileName,
    confirmInstall
  }
})
