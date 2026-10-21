// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { SplitInstallAnalysis } from '@shared/types/split-install'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useDeviceTransferStore } from '@renderer/stores/device-transfer.store'

const SOURCE = 'SOURCE01'
const TARGET = 'TARGET02'
const PKG = 'com.example.app'

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

  beforeEach(() => {
    setActivePinia(createPinia())
    analyzeDeviceTransfer = vi.fn().mockResolvedValue(analysis())
    performDeviceTransfer = vi
      .fn()
      .mockResolvedValue({ success: true, message: 'Installed', rawOutput: 'Success' })
    window.droidor = { analyzeDeviceTransfer, performDeviceTransfer } as unknown as DroidorApi
  })

  afterEach(() => {
    window.droidor = undefined as unknown as DroidorApi
  })

  it('analyzes and then performs exactly the analyzed transfer', async () => {
    const { store, wrapper } = mountProbe()

    await store.analyze(SOURCE, TARGET, PKG)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.version').text()).toBe('7')
    expect(analyzeDeviceTransfer).toHaveBeenCalledWith(SOURCE, TARGET, PKG)

    await store.confirm()
    await wrapper.vm.$nextTick()
    expect(performDeviceTransfer).toHaveBeenCalledWith(SOURCE, TARGET, PKG, 7)
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
})
