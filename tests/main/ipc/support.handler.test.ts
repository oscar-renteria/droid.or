import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannel } from '@shared/constants/ipc-channels'
import type { OpenDonationLinkResult } from '@shared/validation/support.schema'
import { DONATION_URLS } from '@main/support/support-config'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), openExternal: vi.fn() }))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  shell: { openExternal: mocks.openExternal }
}))

const { registerSupportHandlers } = await import('@main/ipc/handlers/support.handler')

type SupportHandler = (_event: unknown, provider: unknown) => Promise<OpenDonationLinkResult>

function getHandler(): SupportHandler {
  const registration = mocks.handle.mock.calls.find(
    ([channel]) => channel === IpcChannel.OpenDonationLink
  )
  if (!registration) throw new Error('Support handler was not registered.')
  return registration[1] as SupportHandler
}

describe('registerSupportHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerSupportHandlers()
  })

  it('opens the configured URL for an approved provider', async () => {
    mocks.openExternal.mockResolvedValue(undefined)

    await expect(getHandler()(undefined, 'github-sponsors')).resolves.toEqual({
      success: true,
      urlOpened: DONATION_URLS['github-sponsors'],
      error: null
    })
    expect(mocks.openExternal).toHaveBeenCalledWith(DONATION_URLS['github-sponsors'])
  })

  it('rejects an unknown provider without opening a browser', async () => {
    await expect(getHandler()(undefined, 'paypal')).resolves.toEqual({
      success: false,
      urlOpened: null,
      error: 'Invalid donation provider.'
    })
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('rejects the retired Ko-fi provider without opening a browser', async () => {
    await expect(getHandler()(undefined, 'kofi')).resolves.toEqual({
      success: false,
      urlOpened: null,
      error: 'Invalid donation provider.'
    })
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('returns a failed launch result when the browser cannot open', async () => {
    mocks.openExternal.mockRejectedValue(new Error('No browser configured'))

    await expect(getHandler()(undefined, 'github-sponsors')).resolves.toEqual({
      success: false,
      urlOpened: DONATION_URLS['github-sponsors'],
      error: 'No browser configured'
    })
  })
})
