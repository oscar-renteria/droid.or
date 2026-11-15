import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { installCrashHandlers, type ProcessLike } from '@main/crash-handlers'

function setup(withDialog = true) {
  const target = new EventEmitter()
  const deps = {
    logger: { error: vi.fn(), directory: '/data/logs' },
    showError: withDialog ? vi.fn() : undefined,
    closeResources: vi.fn(),
    exit: vi.fn()
  }
  const fatal = installCrashHandlers(target as unknown as ProcessLike, deps)
  return { target, deps, fatal }
}

describe('installCrashHandlers', () => {
  it('logs an uncaught exception, tells the user where the log is, closes and exits 1', () => {
    const { target, deps } = setup()
    const error = new Error('boom')
    target.emit('uncaughtException', error)

    expect(deps.logger.error).toHaveBeenCalledWith('Uncaught exception in main process', error)
    expect(deps.showError).toHaveBeenCalledWith(
      'droid.or ran into an unexpected error',
      expect.stringContaining('/data/logs')
    )
    expect(deps.closeResources).toHaveBeenCalledOnce()
    expect(deps.exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('still exits when closing resources throws', () => {
    const { target, deps } = setup()
    deps.closeResources.mockImplementation(() => {
      throw new Error('db already closed')
    })
    expect(() => target.emit('uncaughtException', new Error('boom'))).toThrow('db already closed')
    expect(deps.exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('handles a second exception during shutdown without a second dialog', () => {
    const { target, deps } = setup()
    target.emit('uncaughtException', new Error('first'))
    target.emit('uncaughtException', new Error('second'))
    expect(deps.logger.error).toHaveBeenCalledTimes(2)
    expect(deps.showError).toHaveBeenCalledOnce()
    expect(deps.exit).toHaveBeenCalledOnce()
  })

  it('works without a dialog (smoke-test mode)', () => {
    const { target, deps } = setup(false)
    target.emit('uncaughtException', new Error('boom'))
    expect(deps.exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('only logs an unhandled rejection', () => {
    const { target, deps } = setup()
    target.emit('unhandledRejection', 'adb went away')
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Unhandled promise rejection in main process',
      'adb went away'
    )
    expect(deps.showError).not.toHaveBeenCalled()
    expect(deps.exit).not.toHaveBeenCalled()
  })

  it('returns a fatal handler for startup failures that arrive as rejections', () => {
    const { deps, fatal } = setup()
    fatal('database is locked')
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Uncaught exception in main process',
      new Error('database is locked')
    )
    expect(deps.exit).toHaveBeenCalledExactlyOnceWith(1)
  })
})
