// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { SplitInstallAnalysis } from '@shared/types/split-install'
import type { DeviceTransferPackage } from '@shared/types/device-transfer'
import type { KnownDevice } from '@shared/types/device'
import type { DeviceTransferProgressUpdate } from '@shared/validation/device-transfer.schema'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useDeviceTransferStore } from '@renderer/stores/device-transfer.store'
import { useDevicesStore } from '@renderer/stores/devices.store'

const SOURCE = 'SOURCE01'
const TARGET = 'TARGET02'
const PKG = 'com.example.app'

function device(id: string): KnownDevice {
  return {
    id,
    nickname: null,
    manufacturer: 'Google',
    model: id,
    androidVersion: '15',
    sdkVersion: 35,
    connectionState: 'device',
    firstSeenAt: '2026-10-10T10:00:00.000Z',
    lastConnectedAt: '2026-10-10T10:00:00.000Z'
  }
}

function analysis(overrides: Partial<SplitInstallAnalysis> = {}): SplitInstallAnalysis {
  return {
    sourceKind: 'directory',
    sourcePaths: ['/tmp/droid-or-split-install-x'],
    packageName: PKG,
    versionName: '1.0.0',
    versionCode: 7,
    label: 'Example App',
    iconDataUrl: null,
    devicePrimaryAbi: 'arm64-v8a',
    deviceDensityBucket: null,
    parts: [],
    issues: [],
    canInstall: true,
    plan: { operation: 'fresh-install', currentVersionCode: null },
    ...overrides
  }
}

function mountProbe() {
  const store = useDeviceTransferStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h('div', [
            store.loading ? h('span', { class: 'loading' }) : null,
            store.errorMessage ? h('p', { class: 'error' }, store.errorMessage) : null,
            store.loadingSourcePackages
              ? h('span', { class: 'packages-loading' }, 'Loading packages')
              : null,
            store.sourcePackagesErrorMessage
              ? h('p', { class: 'packages-error' }, store.sourcePackagesErrorMessage)
              : null,
            h(
              'ul',
              { class: 'source-packages' },
              store.sourcePackages.map((pkg) =>
                h('li', { key: pkg.packageName }, pkg.displayName ?? pkg.packageName)
              )
            ),
            store.analysis
              ? h('p', { class: 'version' }, String(store.analysis.versionCode))
              : null,
            store.result ? h('p', { class: 'result' }, store.result.message) : null
          ])
      }
    })
  )
  return { store, wrapper }
}

describe('useDeviceTransferStore', () => {
  let analyzeDeviceTransfer: ReturnType<typeof vi.fn>
  let performDeviceTransfer: ReturnType<typeof vi.fn>
  let getDeviceTransferPackages: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    useDevicesStore().$patch({
      devices: [device(SOURCE), device(TARGET)],
      selectedDeviceId: TARGET
    })
    analyzeDeviceTransfer = vi.fn().mockResolvedValue(analysis())
    performDeviceTransfer = vi
      .fn()
      .mockResolvedValue({ success: true, message: 'Installed', rawOutput: 'Success' })
    getDeviceTransferPackages = vi.fn().mockResolvedValue([])
    window.droidor = {
      analyzeDeviceTransfer,
      performDeviceTransfer,
      getDeviceTransferPackages
    } as unknown as DroidorApi
  })

  afterEach(() => {
    window.droidor = undefined as unknown as DroidorApi
  })

  it('analyzes and then performs exactly the analyzed transfer', async () => {
    const { store, wrapper } = mountProbe()
    analyzeDeviceTransfer.mockImplementationOnce(
      async (
        _sourceDeviceId: string,
        _targetDeviceId: string,
        _packageName: string,
        onProgress?: (progress: DeviceTransferProgressUpdate) => void
      ) => {
        onProgress?.({
          phase: 'pulling',
          fileName: 'base.apk',
          fileNumber: 1,
          totalFiles: 3
        })
        return analysis()
      }
    )

    await store.analyze(SOURCE, TARGET, PKG)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.version').text()).toBe('7')
    expect(store.progress).toEqual({
      phase: 'pulling',
      fileName: 'base.apk',
      fileNumber: 1,
      totalFiles: 3
    })
    expect(analyzeDeviceTransfer.mock.calls[0]?.slice(0, 3)).toEqual([SOURCE, TARGET, PKG])

    performDeviceTransfer.mockImplementationOnce(
      async (
        _sourceDeviceId: string,
        _targetDeviceId: string,
        _packageName: string,
        _expectedVersionCode: number | null,
        onProgress?: (progress: DeviceTransferProgressUpdate) => void
      ) => {
        onProgress?.({ phase: 'installing', fileCount: 3 })
        return { success: true, message: 'Installed', rawOutput: 'Success' }
      }
    )

    await store.confirm()
    await wrapper.vm.$nextTick()
    expect(performDeviceTransfer.mock.calls[0]?.slice(0, 4)).toEqual([SOURCE, TARGET, PKG, 7])
    expect(store.progress).toEqual({ phase: 'installing', fileCount: 3 })
    expect(wrapper.find('.result').text()).toBe('Installed')
  })

  it('shows the error when the analysis fails', async () => {
    analyzeDeviceTransfer.mockRejectedValue(new Error('This app is not installed on the source.'))
    const { store, wrapper } = mountProbe()

    await store.analyze(SOURCE, TARGET, PKG)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.error').text()).toBe('This app is not installed on the source.')
    expect(store.analysis).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('does not perform a transfer whose analysis cannot be installed', async () => {
    analyzeDeviceTransfer.mockResolvedValue(analysis({ canInstall: false }))
    const { store } = mountProbe()

    await store.analyze(SOURCE, TARGET, PKG)
    await store.confirm()

    expect(performDeviceTransfer).not.toHaveBeenCalled()
  })

  it('does not perform anything after reset, e.g. when the target changed', async () => {
    const { store, wrapper } = mountProbe()

    await store.analyze(SOURCE, TARGET, PKG)
    store.reset()
    await store.confirm()
    await wrapper.vm.$nextTick()

    expect(performDeviceTransfer).not.toHaveBeenCalled()
    expect(store.analyzedTargetId).toBeNull()
    expect(wrapper.find('.version').exists()).toBe(false)
  })

  it.each([SOURCE, TARGET])('discards analysis when device %s disconnects', async (deviceId) => {
    const { store } = mountProbe()

    await store.analyze(SOURCE, TARGET, PKG)
    const devicesStore = useDevicesStore()
    devicesStore.devices = devicesStore.devices.map((item) =>
      item.id === deviceId ? { ...item, connectionState: 'disconnected' } : item
    )
    await nextTick()

    expect(store.analysis).toBeNull()
    expect(store.analyzedSourceId).toBeNull()
    expect(store.analyzedTargetId).toBeNull()
    await store.confirm()
    expect(performDeviceTransfer).not.toHaveBeenCalled()
  })

  it('ignores analysis that finishes after a device disconnects', async () => {
    let resolveLate: (value: SplitInstallAnalysis) => void = () => {}
    analyzeDeviceTransfer.mockReturnValueOnce(
      new Promise<SplitInstallAnalysis>((resolve) => {
        resolveLate = resolve
      })
    )
    const { store } = mountProbe()
    const pending = store.analyze(SOURCE, TARGET, PKG)
    const devicesStore = useDevicesStore()

    devicesStore.devices = devicesStore.devices.map((item) =>
      item.id === SOURCE ? { ...item, connectionState: 'disconnected' } : item
    )
    resolveLate(analysis())
    await pending

    expect(store.analysis).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.errorMessage).toBeNull()
  })

  it('ignores an analysis that resolves after a reset', async () => {
    let resolveLate: (value: SplitInstallAnalysis) => void = () => {}
    analyzeDeviceTransfer.mockReturnValueOnce(
      new Promise<SplitInstallAnalysis>((resolve) => {
        resolveLate = resolve
      })
    )
    const { store } = mountProbe()

    const pending = store.analyze(SOURCE, TARGET, PKG)
    store.reset()
    resolveLate(analysis())
    await pending

    expect(store.analysis).toBeNull()
    expect(store.analyzedTargetId).toBeNull()
  })

  it('turns a rejected perform into a failed result', async () => {
    performDeviceTransfer.mockRejectedValue(new Error('The app changed on the source device'))
    const { store, wrapper } = mountProbe()

    await store.analyze(SOURCE, TARGET, PKG)
    await store.confirm()
    await wrapper.vm.$nextTick()

    expect(store.result?.success).toBe(false)
    expect(wrapper.find('.result').text()).toBe('The app changed on the source device')
    expect(store.installing).toBe(false)
  })

  it('loads source packages and exposes the results reactively', async () => {
    const app: DeviceTransferPackage = {
      packageName: PKG,
      displayName: 'Example App',
      versionName: '1.0.0',
      versionCode: 7
    }
    let resolvePackages: (packages: DeviceTransferPackage[]) => void = () => {}
    getDeviceTransferPackages.mockReturnValueOnce(
      new Promise<DeviceTransferPackage[]>((resolve) => {
        resolvePackages = resolve
      })
    )
    const { store, wrapper } = mountProbe()

    const loading = store.loadSourcePackages(SOURCE)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.packages-loading').text()).toBe('Loading packages')

    resolvePackages([app])
    await loading
    await wrapper.vm.$nextTick()

    expect(getDeviceTransferPackages).toHaveBeenCalledWith(SOURCE)
    expect(wrapper.find('.source-packages').text()).toBe('Example App')
    expect(store.loadingSourcePackages).toBe(false)
  })

  it('surfaces source package loading errors and leaves the list empty', async () => {
    getDeviceTransferPackages.mockRejectedValue(new Error('Source device disconnected.'))
    const { store, wrapper } = mountProbe()

    await store.loadSourcePackages(SOURCE)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.packages-error').text()).toBe('Source device disconnected.')
    expect(wrapper.find('.source-packages').text()).toBe('')
    expect(store.loadingSourcePackages).toBe(false)
  })

  it('keeps an empty source response distinct from a loading failure', async () => {
    const { store, wrapper } = mountProbe()

    await store.loadSourcePackages(SOURCE)
    await wrapper.vm.$nextTick()

    expect(store.sourcePackages).toEqual([])
    expect(store.sourcePackagesErrorMessage).toBeNull()
    expect(wrapper.find('.packages-error').exists()).toBe(false)
  })

  it('ignores a package response for a source that is no longer selected', async () => {
    const stalePackage: DeviceTransferPackage = {
      packageName: 'com.example.stale',
      displayName: 'Stale App',
      versionName: '1.0.0',
      versionCode: 1
    }
    const latestPackage: DeviceTransferPackage = {
      packageName: 'com.example.latest',
      displayName: 'Latest App',
      versionName: '2.0.0',
      versionCode: 2
    }
    let resolveStalePackages: (packages: DeviceTransferPackage[]) => void = () => {}
    getDeviceTransferPackages
      .mockReturnValueOnce(
        new Promise<DeviceTransferPackage[]>((resolve) => {
          resolveStalePackages = resolve
        })
      )
      .mockResolvedValueOnce([latestPackage])
    const { store } = mountProbe()

    const staleLoad = store.loadSourcePackages('old-source')
    await store.loadSourcePackages('new-source')
    resolveStalePackages([stalePackage])
    await staleLoad

    expect(store.sourcePackages).toEqual([latestPackage])
  })
})
