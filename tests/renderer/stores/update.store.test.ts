// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { UpdateStatus } from '@shared/validation/update.schema'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateStore } from '@renderer/stores/update.store'

const STATUS: UpdateStatus = {
  currentVersion: '1.0.0',
  latestVersion: '1.1.0',
  updateAvailable: true,
  releaseUrl: 'https://github.com/oscar-renteria/droid.or/releases/tag/v1.1.0',
  checkedAt: 1
}

function stubApi(api: Partial<DroidorApi>): void {
  vi.stubGlobal('droidor', api)
}

describe('useUpdateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes a newer release', async () => {
    stubApi({ getUpdateStatus: vi.fn().mockResolvedValue(STATUS) })
    const store = useUpdateStore()
    await store.load()
    expect(store.updateAvailable).toBe(true)
    expect(store.latestVersion).toBe('1.1.0')
  })

  it('stays hidden when the app is up to date', async () => {
    stubApi({
      getUpdateStatus: vi.fn().mockResolvedValue({ ...STATUS, updateAvailable: false })
    })
    const store = useUpdateStore()
    await store.load()
    expect(store.updateAvailable).toBe(false)
  })

  it('stays hidden when the check fails or the bridge is missing', async () => {
    stubApi({ getUpdateStatus: vi.fn().mockRejectedValue(new Error('ipc failed')) })
    const store = useUpdateStore()
    await store.load()
    expect(store.updateAvailable).toBe(false)

    vi.unstubAllGlobals()
    await store.load()
    expect(store.status).toBeNull()
  })

  it('delegates opening the release page to the bridge', async () => {
    const openReleasePage = vi.fn().mockResolvedValue(undefined)
    stubApi({ openReleasePage })
    await useUpdateStore().openReleasePage()
    expect(openReleasePage).toHaveBeenCalledOnce()
  })
})
