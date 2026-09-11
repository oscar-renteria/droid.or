// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { SplitInstallAnalysis } from '@shared/types/split-install'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useSplitInstallStore } from '@renderer/stores/split-install.store'

const DEVICE_ID = 'R5CY73MF2QL'
const BASE_PATH = '/home/user/base.apk'
const ABI_PATH = '/home/user/split_config.arm64_v8a.apk'
const INCOMPATIBLE_ABI_PATH = '/home/user/split_config.x86_64.apk'

function analysis(overrides: Partial<SplitInstallAnalysis> = {}): SplitInstallAnalysis {
  return {
    sourceKind: 'files',
    sourcePaths: [BASE_PATH, ABI_PATH],
    packageName: 'com.example.app',
    versionName: '1.0.0',
    versionCode: 1,
    label: 'Example App',
    iconDataUrl: null,
    devicePrimaryAbi: 'arm64-v8a',
    deviceDensityBucket: null,
    parts: [
      {
        filePath: BASE_PATH,
        fileName: 'base.apk',
        fileSizeBytes: 1024,
        role: 'base',
        abi: null,
        density: null,
        language: null,
        rawSplitAttribute: null,
        packageName: 'com.example.app',
        versionName: '1.0.0',
        versionCode: 1,
        minSdkVersion: 24,
        targetSdkVersion: 34,
        label: 'Example App',
        iconDataUrl: null,
        deviceCompatible: true
      },
      {
        filePath: ABI_PATH,
        fileName: 'split_config.arm64_v8a.apk',
        fileSizeBytes: 512,
        role: 'abi',
        abi: 'arm64-v8a',
        density: null,
        language: null,
        rawSplitAttribute: 'config.arm64_v8a',
        packageName: 'com.example.app',
        versionName: null,
        versionCode: 1,
        minSdkVersion: null,
        targetSdkVersion: null,
        label: null,
        iconDataUrl: null,
        deviceCompatible: true
      }
    ],
    issues: [],
    canInstall: true,
    plan: { operation: 'fresh-install', currentVersionCode: null },
    ...overrides
  }
}

function mountProbe() {
  const store = useSplitInstallStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            'div',
            [
              store.loading
                ? 'loading'
                : store.analysis
                  ? 'ready'
                  : store.errorMessage
                    ? 'error'
                    : 'idle',
              ':',
              [...store.selectedFileNames].join(',')
            ].join('')
          )
      }
    })
  )
  return { store, wrapper }
}

describe('useSplitInstallStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pre-selects every device-compatible non-base part after a successful analysis', async () => {
    const analyzeSplitInstallSource = vi.fn().mockResolvedValue(analysis())
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzeSplitInstallSource } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.analyzeSource(DEVICE_ID, 'files', [BASE_PATH, ABI_PATH])
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('ready:split_config.arm64_v8a.apk')
    expect(analyzeSplitInstallSource).toHaveBeenCalledWith(DEVICE_ID, 'files', [
      BASE_PATH,
      ABI_PATH
    ])
  })

  it('records which device the analysis was computed for', async () => {
    const analyzeSplitInstallSource = vi.fn().mockResolvedValue(analysis())
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzeSplitInstallSource } as unknown as DroidorApi
    })

    const { store } = mountProbe()
    await store.analyzeSource(DEVICE_ID, 'files', [BASE_PATH, ABI_PATH])

    expect(store.analyzedDeviceId).toBe(DEVICE_ID)
  })

  it('does not pre-select an ABI split the device cannot use', async () => {
    const incompatible = analysis({
      parts: [
        analysis().parts[0]!,
        {
          ...analysis().parts[1]!,
          filePath: INCOMPATIBLE_ABI_PATH,
          fileName: 'split_config.x86_64.apk',
          abi: 'x86_64',
          deviceCompatible: false
        }
      ],
      issues: [{ code: 'no-compatible-abi-split', severity: 'error', message: 'No matching ABI.' }],
      canInstall: false
    })
    const analyzeSplitInstallSource = vi.fn().mockResolvedValue(incompatible)
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzeSplitInstallSource } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.analyzeSource(DEVICE_ID, 'files', [BASE_PATH, INCOMPATIBLE_ABI_PATH])
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('ready:')
    expect(store.analysis?.canInstall).toBe(false)
  })

  it('renders the error state when analysis rejects', async () => {
    const analyzeSplitInstallSource = vi.fn().mockRejectedValue(new Error('No .apk files found'))
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzeSplitInstallSource } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.analyzeSource(DEVICE_ID, 'directory', ['/home/user/empty'])
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('error:')
    expect(store.errorMessage).toMatch(/No \.apk files found/)
  })

  it('toggleFileName adds and removes a part from the selection', async () => {
    const analyzeSplitInstallSource = vi.fn().mockResolvedValue(analysis())
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzeSplitInstallSource } as unknown as DroidorApi
    })

    const { store } = mountProbe()
    await store.analyzeSource(DEVICE_ID, 'files', [BASE_PATH, ABI_PATH])

    expect(store.selectedFileNames.has('split_config.arm64_v8a.apk')).toBe(true)
    store.toggleFileName('split_config.arm64_v8a.apk')
    expect(store.selectedFileNames.has('split_config.arm64_v8a.apk')).toBe(false)
    store.toggleFileName('split_config.arm64_v8a.apk')
    expect(store.selectedFileNames.has('split_config.arm64_v8a.apk')).toBe(true)
  })

  it('confirmInstall calls installSplitApks with the current selection and reports the result', async () => {
    const analyzeSplitInstallSource = vi.fn().mockResolvedValue(analysis())
    const installSplitApks = vi.fn().mockResolvedValue({
      success: true,
      message: 'App installed.',
      rawOutput: 'Success'
    })
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzeSplitInstallSource, installSplitApks } as unknown as DroidorApi
    })

    const { store } = mountProbe()
    await store.analyzeSource(DEVICE_ID, 'files', [BASE_PATH, ABI_PATH])
    await store.confirmInstall(DEVICE_ID)

    expect(installSplitApks).toHaveBeenCalledWith(
      DEVICE_ID,
      'files',
      [BASE_PATH, ABI_PATH],
      ['split_config.arm64_v8a.apk']
    )
    expect(store.installResult?.success).toBe(true)
  })

  it('confirmInstall does nothing when the analysis says installation cannot proceed', async () => {
    const blocked = analysis({ canInstall: false })
    const analyzeSplitInstallSource = vi.fn().mockResolvedValue(blocked)
    const installSplitApks = vi.fn()
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzeSplitInstallSource, installSplitApks } as unknown as DroidorApi
    })

    const { store } = mountProbe()
    await store.analyzeSource(DEVICE_ID, 'files', [BASE_PATH, ABI_PATH])
    await store.confirmInstall(DEVICE_ID)

    expect(installSplitApks).not.toHaveBeenCalled()
  })

  it('reset clears source, analysis, selection, and result', async () => {
    const analyzeSplitInstallSource = vi.fn().mockResolvedValue(analysis())
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzeSplitInstallSource } as unknown as DroidorApi
    })

    const { store } = mountProbe()
    await store.analyzeSource(DEVICE_ID, 'files', [BASE_PATH, ABI_PATH])
    store.reset()

    expect(store.sourceKind).toBeNull()
    expect(store.sourcePaths).toEqual([])
    expect(store.analysis).toBeNull()
    expect(store.selectedFileNames.size).toBe(0)
    expect(store.analyzedDeviceId).toBeNull()
    expect(store.installResult).toBeNull()
  })
})
