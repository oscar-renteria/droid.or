// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ONBOARDING_SEEN_KEY, useOnboardingStore } from '@renderer/stores/onboarding.store'

describe('useOnboardingStore', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('is unseen on a first run', () => {
    expect(useOnboardingStore().seen).toBe(false)
  })

  it('remembers dismissal across app starts', () => {
    useOnboardingStore().dismiss()
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('true')

    setActivePinia(createPinia())
    expect(useOnboardingStore().seen).toBe(true)
  })

  it('can be reopened from Settings and closed again', () => {
    const store = useOnboardingStore()
    store.dismiss()
    store.open()
    expect(store.reopened).toBe(true)
    store.dismiss()
    expect(store.reopened).toBe(false)
    expect(store.seen).toBe(true)
  })

  it('shows the guide when storage is unavailable instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const store = useOnboardingStore()
    expect(store.seen).toBe(false)
    expect(() => store.dismiss()).not.toThrow()
    expect(store.seen).toBe(true)
  })
})
