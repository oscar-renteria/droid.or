// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { AdbCommandLogEntry } from '@shared/types/logs'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useLogsStore } from '@renderer/stores/logs.store'

const ENTRIES: AdbCommandLogEntry[] = [
  {
    id: 2,
    timestamp: '2026-09-08T12:00:00.000Z',
    deviceId: 'R5CY73MF2QL',
    category: 'shell',
    command: 'dumpsys battery',
    durationMs: 12,
    success: true,
    errorMessage: null
  },
  {
    id: 1,
    timestamp: '2026-09-08T11:59:00.000Z',
    deviceId: null,
    category: 'list-devices',
    command: 'devices -l',
    durationMs: 8,
    success: true,
    errorMessage: null
  }
]

function mountProbe() {
  const store = useLogsStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () => h('div', store.loading ? 'loading' : `${store.entries.length} entries`)
      }
    })
  )
  return { store, wrapper }
}

describe('useLogsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the loaded entry count once load resolves', async () => {
    const getLogs = vi.fn().mockResolvedValue(ENTRIES)
    vi.stubGlobal('window', { ...window, droidor: { getLogs } as unknown as DroidorApi })

    const { store, wrapper } = mountProbe()
    const loadPromise = store.load()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('loading')

    await loadPromise
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('2 entries')
    expect(store.entries).toEqual(ENTRIES)
  })

  it('surfaces an error message and leaves entries empty when the load fails', async () => {
    const getLogs = vi.fn().mockRejectedValue(new Error('main process unavailable'))
    vi.stubGlobal('window', { ...window, droidor: { getLogs } as unknown as DroidorApi })

    const { store } = mountProbe()
    await store.load()

    expect(store.entries).toEqual([])
    expect(store.errorMessage).toBe('main process unavailable')
  })

  it('clear empties the store after clearing the main-process log', async () => {
    const getLogs = vi.fn().mockResolvedValue(ENTRIES)
    const clearLogs = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('window', {
      ...window,
      droidor: { getLogs, clearLogs } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.load()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('2 entries')

    await store.clear()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('0 entries')
    expect(clearLogs).toHaveBeenCalled()
  })

  it('exportLogs returns the chosen path from the main process', async () => {
    const exportLogs = vi.fn().mockResolvedValue('/home/user/droidor-logs.json')
    vi.stubGlobal('window', { ...window, droidor: { exportLogs } as unknown as DroidorApi })

    const { store } = mountProbe()
    const path = await store.exportLogs()

    expect(path).toBe('/home/user/droidor-logs.json')
  })
})
