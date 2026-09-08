// @vitest-environment jsdom
import type { AiSettings } from '@shared/types/ai-settings'
import type { DroidorApi } from '@shared/types/droidor-api'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useAiSettingsStore } from '@renderer/stores/ai-settings.store'

const SETTINGS: AiSettings = {
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  baseUrl: null,
  hasApiKey: true
}

function mountProbe() {
  const store = useAiSettingsStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () => h('div', store.loading ? 'loading' : (store.settings?.provider ?? 'none'))
      }
    })
  )
  return { store, wrapper }
}

describe('useAiSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the loaded provider once load resolves', async () => {
    const getAiSettings = vi.fn().mockResolvedValue(SETTINGS)
    vi.stubGlobal('window', { ...window, droidor: { getAiSettings } as unknown as DroidorApi })

    const { store, wrapper } = mountProbe()
    const loadPromise = store.load()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('loading')

    await loadPromise
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('anthropic')
    expect(store.settings).toEqual(SETTINGS)
  })

  it('save returns true and updates settings on success', async () => {
    const setAiSettings = vi.fn().mockResolvedValue(SETTINGS)
    vi.stubGlobal('window', { ...window, droidor: { setAiSettings } as unknown as DroidorApi })

    const { store, wrapper } = mountProbe()
    const ok = await store.save({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      baseUrl: null,
      apiKey: 'sk-new'
    })
    await wrapper.vm.$nextTick()

    expect(ok).toBe(true)
    expect(wrapper.text()).toBe('anthropic')
    expect(setAiSettings).toHaveBeenCalledWith({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      baseUrl: null,
      apiKey: 'sk-new'
    })
  })

  it('save returns false and sets an error message when the main process rejects', async () => {
    const setAiSettings = vi.fn().mockRejectedValue(new Error('secret storage unavailable'))
    vi.stubGlobal('window', { ...window, droidor: { setAiSettings } as unknown as DroidorApi })

    const { store } = mountProbe()
    const ok = await store.save({ provider: 'anthropic', model: 'm', baseUrl: null })

    expect(ok).toBe(false)
    expect(store.errorMessage).toBe('secret storage unavailable')
  })
})
