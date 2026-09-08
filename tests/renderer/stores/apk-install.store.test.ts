// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { ApkInspectionResult } from '@shared/types/apk-install'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useApkInstallStore } from '@renderer/stores/apk-install.store'

const DEVICE_ID = 'R5CY73MF2QL'
const FILE_PATH = '/home/user/app.apk'

const INSPECTION_RESULT: ApkInspectionResult = {
  info: {
    filePath: FILE_PATH,
    fileName: 'app.apk',
    fileSizeBytes: 1024,
    packageName: 'com.example.app',
    versionName: '1.0.0',
    versionCode: 1,
    minSdkVersion: 24,
    targetSdkVersion: 34,
    label: 'Example App',
    iconDataUrl: null
  },
  plan: { operation: 'fresh-install', currentVersionCode: null }
}

/** Mounts a minimal component that reads the store through the same
 *  reactive path a real view does (template-style render, not a direct
 *  read off the store object) — this is what actually exercises Vue's
 *  reactivity tracking. A bare "call the action, then read store.queue"
 *  assertion would still pass even with a bug where mutations bypass the
 *  reactive proxy, since the underlying data genuinely changes either
 *  way; only a rendered view fails to notice. */
function mountProbe() {
  const store = useApkInstallStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () => h('div', store.queue.map((item) => item.status).join(','))
      }
    })
  )
  return { store, wrapper }
}

describe('useApkInstallStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates the rendered status once inspection resolves, not just the raw store data', async () => {
    const inspectApkFile = vi.fn().mockResolvedValue(INSPECTION_RESULT)
    vi.stubGlobal('window', { ...window, droidor: { inspectApkFile } as unknown as DroidorApi })

    const { store, wrapper } = mountProbe()

    const addFilesPromise = store.addFiles(DEVICE_ID, [FILE_PATH])
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('inspecting')

    await addFilesPromise
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('ready')
    expect(store.queue[0]?.info?.packageName).toBe('com.example.app')
    expect(store.queue[0]?.plan?.operation).toBe('fresh-install')
  })

  it('moves a failed inspection to the error status, rendered too', async () => {
    const inspectApkFile = vi.fn().mockRejectedValue(new Error("couldn't be read as an APK"))
    vi.stubGlobal('window', { ...window, droidor: { inspectApkFile } as unknown as DroidorApi })

    const { store, wrapper } = mountProbe()
    await store.addFiles(DEVICE_ID, [FILE_PATH])
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('error')
    expect(store.queue[0]?.message).toMatch(/couldn't be read as an APK/)
  })

  it('renders through installing to success', async () => {
    const inspectApkFile = vi.fn().mockResolvedValue(INSPECTION_RESULT)
    const installApk = vi.fn().mockResolvedValue({
      success: true,
      message: 'App installed.',
      rawOutput: 'Success'
    })
    vi.stubGlobal('window', {
      ...window,
      droidor: { inspectApkFile, installApk } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.addFiles(DEVICE_ID, [FILE_PATH])
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('ready')

    await store.installItem(DEVICE_ID, FILE_PATH)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('success')
    expect(store.queue[0]?.message).toBe('App installed.')
  })

  it('does not add the same path to the queue twice', async () => {
    const inspectApkFile = vi.fn().mockResolvedValue(INSPECTION_RESULT)
    vi.stubGlobal('window', { ...window, droidor: { inspectApkFile } as unknown as DroidorApi })

    const { store } = mountProbe()
    await store.addFiles(DEVICE_ID, [FILE_PATH])
    await store.addFiles(DEVICE_ID, [FILE_PATH])

    expect(store.queue).toHaveLength(1)
    expect(inspectApkFile).toHaveBeenCalledTimes(1)
  })
})
