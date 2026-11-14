import type { OperationResult } from '@shared/types/operation'
import type { SplitInstallAnalysis } from '@shared/types/split-install'
import type { DeviceTransferPackage } from '@shared/types/device-transfer'
import type { DeviceTransferProgressUpdate } from '@shared/validation/device-transfer.schema'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useDevicesStore } from '@renderer/stores/devices.store'

export const useDeviceTransferStore = defineStore('deviceTransfer', () => {
  const devicesStore = useDevicesStore()
  const sourcePackages = ref<DeviceTransferPackage[]>([])
  const loadingSourcePackages = ref(false)
  const sourcePackagesErrorMessage = ref<string | null>(null)

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
  const progress = ref<DeviceTransferProgressUpdate | null>(null)
  const activeSourceId = ref<string | null>(null)
  const activeTargetId = ref<string | null>(null)

  const busy = computed(() => loading.value || installing.value)

  /** Bumped by reset(), so a request that resolves after its state was
   *  thrown away can't write into (or un-busy) whatever came next. */
  let generation = 0
  let sourcePackagesGeneration = 0

  watch(
    () => ({
      sourceId: activeSourceId.value,
      targetId: activeTargetId.value,
      connectedIds: devicesStore.devices
        .filter((device) => device.connectionState === 'device')
        .map((device) => device.id)
    }),
    ({ sourceId, targetId, connectedIds }) => {
      if (
        !busy.value &&
        !result.value &&
        ((sourceId !== null && !connectedIds.includes(sourceId)) ||
          (targetId !== null && !connectedIds.includes(targetId)))
      ) {
        reset()
      }
    },
    { flush: 'sync' }
  )

  function resetSourcePackages(): void {
    sourcePackagesGeneration += 1
    sourcePackages.value = []
    loadingSourcePackages.value = false
    sourcePackagesErrorMessage.value = null
  }

  function isDeviceConnected(id: string): boolean {
    return devicesStore.devices.some(
      (device) => device.id === id && device.connectionState === 'device'
    )
  }

  async function loadSourcePackages(sourceDeviceId: string): Promise<void> {
    if (!window.droidor) {
      resetSourcePackages()
      sourcePackagesErrorMessage.value = 'Device transfer is unavailable.'
      return
    }

    const requestGeneration = ++sourcePackagesGeneration
    sourcePackages.value = []
    loadingSourcePackages.value = true
    sourcePackagesErrorMessage.value = null
    try {
      const response = await window.droidor.getDeviceTransferPackages(sourceDeviceId)
      if (requestGeneration === sourcePackagesGeneration) {
        sourcePackages.value = response
      }
    } catch (error) {
      if (requestGeneration === sourcePackagesGeneration) {
        sourcePackagesErrorMessage.value =
          error instanceof Error ? error.message : 'Failed to load apps from the source device.'
      }
    } finally {
      if (requestGeneration === sourcePackagesGeneration) {
        loadingSourcePackages.value = false
      }
    }
  }

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
    progress.value = null
    activeSourceId.value = null
    activeTargetId.value = null
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
    activeSourceId.value = sourceDeviceId
    activeTargetId.value = targetDeviceId
    loading.value = true
    try {
      const response = await window.droidor.analyzeDeviceTransfer(
        sourceDeviceId,
        targetDeviceId,
        packageName,
        (update) => {
          if (requestGeneration === generation) {
            progress.value = update
          }
        }
      )
      if (requestGeneration !== generation) {
        return
      }
      if (!isDeviceConnected(sourceDeviceId) || !isDeviceConnected(targetDeviceId)) {
        reset()
        return
      }
      analysis.value = response
      analyzedSourceId.value = sourceDeviceId
      analyzedTargetId.value = targetDeviceId
      analyzedPackageName.value = packageName
    } catch (error) {
      if (requestGeneration === generation) {
        if (!isDeviceConnected(sourceDeviceId) || !isDeviceConnected(targetDeviceId)) {
          reset()
        } else {
          errorMessage.value =
            error instanceof Error
              ? error.message
              : 'Failed to copy this app from the source device.'
        }
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
      installing.value ||
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
    progress.value = null
    let outcome: OperationResult
    try {
      outcome = await window.droidor.performDeviceTransfer(
        analyzedSourceId.value,
        analyzedTargetId.value,
        analyzedPackageName.value,
        analysis.value.versionCode,
        (update) => {
          if (requestGeneration === generation) {
            progress.value = update
          }
        }
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
    sourcePackages,
    loadingSourcePackages,
    sourcePackagesErrorMessage,
    loadSourcePackages,
    resetSourcePackages,
    analysis,
    analyzedSourceId,
    analyzedTargetId,
    analyzedPackageName,
    loading,
    errorMessage,
    installing,
    result,
    progress,
    busy,
    reset,
    analyze,
    confirm
  }
})
