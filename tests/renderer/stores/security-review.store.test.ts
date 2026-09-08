// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { SecurityReviewResult } from '@shared/types/security-review'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useSecurityReviewStore } from '@renderer/stores/security-review.store'

const DEVICE_ID = 'HA1HHCD3'

const RESULT: SecurityReviewResult = {
  deviceAdminPackages: ['com.example.finder'],
  accessibilityServicePackages: ['com.example.reader']
}

/** Mounts a minimal component that reads the store through the same
 *  reactive path a real view does, not a direct read off the store
 *  object — see apk-install.store.test.ts for why this matters. */
function mountProbe() {
  const store = useSecurityReviewStore()
  const wrapper = mount(
    defineComponent({
      setup() {
        return () =>
          h(
            'div',
            store.loading
              ? 'loading'
              : (store.errorMessage ?? store.result?.deviceAdminPackages.join(','))
          )
      }
    })
  )
  return { store, wrapper }
}

describe('useSecurityReviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the result once the review resolves', async () => {
    const getSecurityReview = vi.fn().mockResolvedValue(RESULT)
    vi.stubGlobal('window', {
      ...window,
      droidor: { getSecurityReview } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    const reviewPromise = store.review(DEVICE_ID)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('loading')

    await reviewPromise
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('com.example.finder')
    expect(store.result).toEqual(RESULT)
    expect(getSecurityReview).toHaveBeenCalledWith(DEVICE_ID)
  })

  it('renders an error message when the review rejects, rather than a stale result', async () => {
    const getSecurityReview = vi.fn().mockRejectedValue(new Error('device offline'))
    vi.stubGlobal('window', {
      ...window,
      droidor: { getSecurityReview } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.review(DEVICE_ID)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('device offline')
    expect(store.result).toBeNull()
  })

  it('reset clears a previous result and error', async () => {
    const getSecurityReview = vi.fn().mockResolvedValue(RESULT)
    vi.stubGlobal('window', {
      ...window,
      droidor: { getSecurityReview } as unknown as DroidorApi
    })

    const { store, wrapper } = mountProbe()
    await store.review(DEVICE_ID)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toBe('com.example.finder')

    store.reset()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('')
    expect(store.result).toBeNull()
    expect(store.errorMessage).toBeNull()
  })
})
