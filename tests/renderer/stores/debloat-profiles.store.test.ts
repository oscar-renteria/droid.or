// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useDebloatProfilesStore } from '@renderer/stores/debloat-profiles.store'

const DEVICE_ID = 'R5CY73MF2QL'

/** Mounts a component that reads the store through Vue's own reactivity
 *  (a render function, not a direct post-hoc read of the store object) —
 *  the only way to actually catch a mutation that bypasses the reactive
 *  proxy, the exact class of bug found (and fixed) in the APK-install
 *  queue during M9. */
function mountProbe() {
  const store = useDebloatProfilesStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            'div',
            [...store.results.entries()]
              .map(([pkg, result]) => `${pkg}:${result.success}`)
              .join(',')
          )
      }
    })
  )
  return { store, wrapper }
}

describe('useDebloatProfilesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders each package result as it completes, in order, sequentially', async () => {
    const performOperation = vi
      .fn()
      .mockResolvedValueOnce({ success: true, message: 'Disabled.', rawOutput: '' })
      .mockResolvedValueOnce({ success: false, message: 'Failed.', rawOutput: '' })
    vi.stubGlobal('window', {
      ...window,
      droidor: { performOperation } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()

    const applyPromise = store.applyToPackages(
      DEVICE_ID,
      ['com.example.a', 'com.example.b'],
      'disable'
    )
    expect(store.applying).toBe(true)

    const { succeeded, failed } = await applyPromise
    await wrapper.vm.$nextTick()

    expect(succeeded).toBe(1)
    expect(failed).toBe(1)
    expect(store.applying).toBe(false)
    expect(wrapper.text()).toBe('com.example.a:true,com.example.b:false')
    expect(performOperation).toHaveBeenNthCalledWith(1, DEVICE_ID, 'com.example.a', 'disable')
    expect(performOperation).toHaveBeenNthCalledWith(2, DEVICE_ID, 'com.example.b', 'disable')
  })

  it('treats a null result (e.g. preload unavailable) as a failure rather than throwing', async () => {
    const performOperation = vi.fn().mockResolvedValueOnce(null)
    vi.stubGlobal('window', {
      ...window,
      droidor: { performOperation } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    const { succeeded, failed } = await store.applyToPackages(
      DEVICE_ID,
      ['com.example.a'],
      'disable'
    )
    await wrapper.vm.$nextTick()

    expect(succeeded).toBe(0)
    expect(failed).toBe(1)
    expect(wrapper.text()).toBe('com.example.a:false')
  })

  it('reset clears prior results', async () => {
    const performOperation = vi
      .fn()
      .mockResolvedValueOnce({ success: true, message: 'Disabled.', rawOutput: '' })
    vi.stubGlobal('window', {
      ...window,
      droidor: { performOperation } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.applyToPackages(DEVICE_ID, ['com.example.a'], 'disable')
    store.reset()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('')
    expect(store.results.size).toBe(0)
  })
})
