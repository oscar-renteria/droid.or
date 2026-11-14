import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannel } from '@shared/constants/ipc-channels'
import type { UpdateStatus } from '@shared/validation/update.schema'
import type { UpdateCheckService } from '@main/update/update-check.service'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), openExternal: vi.fn() }))

vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  shell: { openExternal: mocks.openExternal }
}))

const { registerUpdateHandlers } = await import('@main/ipc/handlers/update.handler')

const NEWER: UpdateStatus = {
  currentVersion: '1.0.0',
  latestVersion: '1.1.0',
  updateAvailable: true,
  releaseUrl: 'https://github.com/oscar-renteria/droid.or/releases/tag/v1.1.0',
  checkedAt: 1,
  checkEnabled: true
}

function handler(channel: IpcChannel): (...args: unknown[]) => Promise<unknown> {
  const registration = mocks.handle.mock.calls.find(([name]) => name === channel)
  if (!registration) throw new Error(`${channel} was not registered`)
  return registration[1] as (...args: unknown[]) => Promise<unknown>
}

describe('registerUpdateHandlers', () => {
  let status: UpdateStatus

  beforeEach(() => {
    vi.clearAllMocks()
    status = NEWER
    registerUpdateHandlers({
      getStatus: () => Promise.resolve(status),
      setEnabled: (enabled: boolean) => Promise.resolve({ ...status, checkEnabled: enabled })
    } as unknown as UpdateCheckService)
  })

  it('returns the validated update status', async () => {
    await expect(handler(IpcChannel.GetUpdateStatus)(undefined)).resolves.toEqual(NEWER)
  })

  it('opens the release page resolved in the main process', async () => {
    await handler(IpcChannel.OpenReleasePage)(undefined, 'https://ignored.example')
    expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith(NEWER.releaseUrl)
  })

  it('refuses when no release is known', async () => {
    status = { ...NEWER, latestVersion: null, updateAvailable: false, releaseUrl: null }
    await expect(handler(IpcChannel.OpenReleasePage)(undefined)).rejects.toThrow(
      'No release page is available.'
    )
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('refuses a release URL outside the allow-list', async () => {
    status = { ...NEWER, releaseUrl: 'http://github.com/oscar-renteria/droid.or/releases' }
    await expect(handler(IpcChannel.OpenReleasePage)(undefined)).rejects.toThrow()
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('persists the toggle and rejects non-boolean input', async () => {
    await expect(
      handler(IpcChannel.SetUpdateCheckEnabled)(undefined, false)
    ).resolves.toMatchObject({ checkEnabled: false })
    await expect(handler(IpcChannel.SetUpdateCheckEnabled)(undefined, 'false')).rejects.toThrow()
  })
})
