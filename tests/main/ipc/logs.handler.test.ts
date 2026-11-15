import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IpcChannel } from '@shared/constants/ipc-channels'
import { AdbCommandLog } from '@main/adb/adb-command-log'
import type { FileLogger } from '@main/logging/file-logger'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), openPath: vi.fn() }))

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  dialog: { showSaveDialog: vi.fn() },
  ipcMain: { handle: mocks.handle },
  shell: { openPath: mocks.openPath }
}))

const { registerLogsHandlers } = await import('@main/ipc/handlers/logs.handler')

function handler(channel: IpcChannel): (...args: unknown[]) => unknown {
  const registration = mocks.handle.mock.calls.find(([name]) => name === channel)
  if (!registration) throw new Error(`${channel} was not registered`)
  return registration[1] as (...args: unknown[]) => unknown
}

describe('registerLogsHandlers', () => {
  const logger = { error: vi.fn(), directory: '/data/logs' }

  beforeEach(() => {
    vi.clearAllMocks()
    registerLogsHandlers(new AdbCommandLog(), logger as unknown as FileLogger)
  })

  it('writes a valid renderer error report to the log file', () => {
    handler(IpcChannel.LogRendererError)(undefined, {
      source: 'vue',
      message: 'boom',
      stack: 'Error: boom\n    at x',
      info: 'render function'
    })
    expect(logger.error).toHaveBeenCalledWith(
      'Renderer error (vue) in render function: boom',
      'Error: boom\n    at x'
    )
  })

  it('rejects malformed or oversized reports', () => {
    expect(() => handler(IpcChannel.LogRendererError)(undefined, { message: 'x' })).toThrow()
    expect(() =>
      handler(IpcChannel.LogRendererError)(undefined, {
        source: 'vue',
        message: 'x'.repeat(2_001),
        stack: null,
        info: null
      })
    ).toThrow()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('opens the log directory', async () => {
    mocks.openPath.mockResolvedValue('')
    await handler(IpcChannel.OpenLogsFolder)(undefined)
    expect(mocks.openPath).toHaveBeenCalledWith('/data/logs')
  })
})
