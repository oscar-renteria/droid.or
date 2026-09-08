// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useSafetyDisclaimerStore } from '@renderer/stores/safety-disclaimer.store'

function mountProbe() {
  const store = useSafetyDisclaimerStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            'div',
            store.loading ? 'loading' : store.acknowledgedAt === null ? 'blocked' : 'unlocked'
          )
      }
    })
  )
  return { store, wrapper }
}

describe('useSafetyDisclaimerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders blocked when the disclaimer was never acknowledged', async () => {
    const getSafetyDisclaimerStatus = vi.fn().mockResolvedValue({ acknowledgedAt: null })
    vi.stubGlobal('window', {
      ...window,
      droidor: { getSafetyDisclaimerStatus } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    const checkPromise = store.check()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('loading')

    await checkPromise
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('blocked')
  })

  it('renders unlocked when a prior acknowledgement is found', async () => {
    const getSafetyDisclaimerStatus = vi.fn().mockResolvedValue({
      acknowledgedAt: '2026-09-01T10:00:00.000Z'
    })
    vi.stubGlobal('window', {
      ...window,
      droidor: { getSafetyDisclaimerStatus } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.check()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('unlocked')
  })

  it('flips from blocked to unlocked once acknowledge resolves', async () => {
    const getSafetyDisclaimerStatus = vi.fn().mockResolvedValue({ acknowledgedAt: null })
    const acknowledgeSafetyDisclaimer = vi.fn().mockResolvedValue({
      acknowledgedAt: '2026-09-08T20:00:00.000Z'
    })
    vi.stubGlobal('window', {
      ...window,
      droidor: {
        getSafetyDisclaimerStatus,
        acknowledgeSafetyDisclaimer
      } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.check()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('blocked')

    await store.acknowledge()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('unlocked')
    expect(store.acknowledgedAt).toBe('2026-09-08T20:00:00.000Z')
  })

  it('surfaces an error and stops loading if the initial check fails', async () => {
    const getSafetyDisclaimerStatus = vi
      .fn()
      .mockRejectedValue(new Error('main process unavailable'))
    vi.stubGlobal('window', {
      ...window,
      droidor: { getSafetyDisclaimerStatus } as unknown as DroidorApi
    })

    const { store } = mountProbe()
    await store.check()

    expect(store.loading).toBe(false)
    expect(store.errorMessage).toBe('main process unavailable')
  })
})
