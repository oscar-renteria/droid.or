// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { OpenDonationLinkResult } from '@shared/validation/support.schema'
import { useSupportLink } from '@renderer/composables/useSupportLink'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const messageApi = {
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn()
}

function stubDonationLink(openDonationLink: DroidorApi['openDonationLink']): void {
  vi.stubGlobal('window', { droidor: { openDonationLink } })
}

describe('useSupportLink', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('opens the requested provider and reports success', async () => {
    const openDonationLink = vi.fn<DroidorApi['openDonationLink']>().mockResolvedValue({
      success: true,
      urlOpened: 'https://github.com/sponsors/oscar-renteria',
      error: null
    })
    stubDonationLink(openDonationLink)

    const { opening, openSupportLink } = useSupportLink(messageApi)
    const request = openSupportLink('github-sponsors')

    expect(opening.value).toBe(true)
    await request

    expect(openDonationLink).toHaveBeenCalledWith('github-sponsors')
    expect(messageApi.info).toHaveBeenCalledWith('Opening link in your browser…')
    expect(opening.value).toBe(true)

    await vi.advanceTimersByTimeAsync(1000)
    expect(opening.value).toBe(false)
  })

  it('opens PayPal through the donation bridge', async () => {
    const openDonationLink = vi.fn<DroidorApi['openDonationLink']>().mockResolvedValue({
      success: true,
      urlOpened: 'https://paypal.me/ORenteriaQuevedo',
      error: null
    })
    stubDonationLink(openDonationLink)

    const { openSupportLink } = useSupportLink(messageApi)
    await openSupportLink('paypal')

    expect(openDonationLink).toHaveBeenCalledWith('paypal')
    expect(messageApi.info).toHaveBeenCalledWith('Opening link in your browser…')
  })

  it('warns and copies the URL when the browser cannot open it', async () => {
    const url = 'https://github.com/sponsors/oscar-renteria'
    const openDonationLink = vi.fn<DroidorApi['openDonationLink']>().mockResolvedValue({
      success: false,
      urlOpened: url,
      error: 'blocked by pop-up blocker'
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubDonationLink(openDonationLink)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { openSupportLink } = useSupportLink(messageApi)
    await openSupportLink('github-sponsors')

    expect(messageApi.warning).toHaveBeenCalledWith('blocked by pop-up blocker')
    expect(writeText).toHaveBeenCalledWith(url)
  })

  it('uses the fallback warning when no error message or URL is returned', async () => {
    const openDonationLink = vi.fn<DroidorApi['openDonationLink']>().mockResolvedValue({
      success: false,
      urlOpened: null,
      error: null
    })
    stubDonationLink(openDonationLink)

    const { openSupportLink } = useSupportLink(messageApi)
    await openSupportLink('github-sponsors')

    expect(messageApi.warning).toHaveBeenCalledWith(
      'Could not open the browser. Link copied to clipboard.'
    )
  })

  it('reports bridge errors and ignores duplicate requests while one is pending', async () => {
    let resolveRequest!: (result: OpenDonationLinkResult) => void
    const openDonationLink = vi.fn<DroidorApi['openDonationLink']>().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve
        })
    )
    stubDonationLink(openDonationLink)

    const { opening, openSupportLink } = useSupportLink(messageApi)
    const request = openSupportLink('github-sponsors')
    await openSupportLink('github-sponsors')

    expect(openDonationLink).toHaveBeenCalledTimes(1)
    expect(opening.value).toBe(true)
    resolveRequest({ success: true, urlOpened: null, error: null })
    await request

    await vi.advanceTimersByTimeAsync(1000)
    openDonationLink.mockRejectedValueOnce(new Error('bridge unavailable'))
    await openSupportLink('github-sponsors')

    expect(messageApi.error).toHaveBeenCalledWith('Failed to open the donation link.')
  })
})
