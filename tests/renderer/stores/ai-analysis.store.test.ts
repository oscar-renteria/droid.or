// @vitest-environment jsdom
import type { AiAnalysisResult } from '@shared/types/ai-settings'
import type { DroidorApi } from '@shared/types/droidor-api'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useAiAnalysisStore } from '@renderer/stores/ai-analysis.store'

const PACKAGE_NAME = 'com.example.app'
const RESULT: AiAnalysisResult = {
  text: 'This looks safe to disable.',
  model: 'claude-sonnet-5',
  provider: 'anthropic'
}

function mountProbe(packageName: string) {
  const store = useAiAnalysisStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () => {
          const state = store.stateFor(packageName)
          return h(
            'div',
            state.loading ? 'loading' : (state.result?.text ?? state.errorMessage ?? '')
          )
        }
      }
    })
  )
  return { store, wrapper }
}

describe('useAiAnalysisStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the loading state, then the resolved result', async () => {
    const analyzePackageWithAi = vi.fn().mockResolvedValue(RESULT)
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzePackageWithAi } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe(PACKAGE_NAME)
    const analyzePromise = store.analyze('R5CY73MF2QL', PACKAGE_NAME, 'Example', '1.0', true)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('loading')

    await analyzePromise
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('This looks safe to disable.')
    expect(analyzePackageWithAi).toHaveBeenCalledWith({
      deviceId: 'R5CY73MF2QL',
      packageName: PACKAGE_NAME,
      displayName: 'Example',
      versionName: '1.0',
      isSystemApp: true
    })
  })

  it('renders an error message when the analysis rejects', async () => {
    const analyzePackageWithAi = vi
      .fn()
      .mockRejectedValue(new Error('No AI provider is configured yet.'))
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzePackageWithAi } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe(PACKAGE_NAME)
    await store.analyze('R5CY73MF2QL', PACKAGE_NAME, 'Example', '1.0', true)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('No AI provider is configured yet.')
  })

  it('keeps state independent per package', async () => {
    const analyzePackageWithAi = vi.fn().mockResolvedValue(RESULT)
    vi.stubGlobal('window', {
      ...window,
      droidor: { analyzePackageWithAi } as unknown as DroidorApi
    })

    const { store } = mountProbe(PACKAGE_NAME)
    await store.analyze('R5CY73MF2QL', PACKAGE_NAME, 'Example', '1.0', true)

    expect(store.stateFor('com.other.app')).toEqual({
      result: null,
      loading: false,
      errorMessage: null
    })
    expect(store.stateFor(PACKAGE_NAME).result).toEqual(RESULT)
  })
})
