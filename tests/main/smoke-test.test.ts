import { describe, expect, it, vi } from 'vitest'
import { isSmokeTest, runSmokeTest } from '@main/smoke-test'

function makeChecks(overrides: Partial<Parameters<typeof runSmokeTest>[0]> = {}) {
  return {
    checkDatabase: vi.fn(),
    waitForRenderer: vi.fn(() => Promise.resolve()),
    log: vi.fn(),
    exit: vi.fn(),
    ...overrides
  }
}

describe('isSmokeTest', () => {
  it('detects the flag anywhere in argv', () => {
    expect(isSmokeTest(['droid-or', '--no-sandbox', '--smoke-test'])).toBe(true)
  })

  it('is false without the flag', () => {
    expect(isSmokeTest(['droid-or', '--smoke-testing'])).toBe(false)
  })
})

describe('runSmokeTest', () => {
  it('exits 0 when the database and renderer checks pass', async () => {
    const checks = makeChecks()
    await runSmokeTest(checks)
    expect(checks.checkDatabase).toHaveBeenCalledOnce()
    expect(checks.waitForRenderer).toHaveBeenCalledOnce()
    expect(checks.exit).toHaveBeenCalledExactlyOnceWith(0)
  })

  it('exits 1 without waiting for the renderer when the database check throws', async () => {
    const checks = makeChecks({
      checkDatabase: vi.fn(() => {
        throw new Error('native module failed to load')
      })
    })
    await runSmokeTest(checks)
    expect(checks.waitForRenderer).not.toHaveBeenCalled()
    expect(checks.exit).toHaveBeenCalledExactlyOnceWith(1)
    expect(checks.log).toHaveBeenCalledWith('smoke test FAILED: native module failed to load')
  })

  it('exits 1 when the renderer fails to load', async () => {
    const checks = makeChecks({
      waitForRenderer: vi.fn(() => Promise.reject(new Error('did-fail-load: ERR_FILE_NOT_FOUND')))
    })
    await runSmokeTest(checks)
    expect(checks.exit).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('exits 1 when the renderer never becomes ready', async () => {
    vi.useFakeTimers()
    try {
      const checks = makeChecks({ waitForRenderer: vi.fn(() => new Promise<void>(() => {})) })
      const run = runSmokeTest({ ...checks, timeoutMs: 1_000 })
      await vi.advanceTimersByTimeAsync(1_000)
      await run
      expect(checks.exit).toHaveBeenCalledExactlyOnceWith(1)
      expect(checks.log).toHaveBeenCalledWith(expect.stringContaining('timed out after 1000 ms'))
    } finally {
      vi.useRealTimers()
    }
  })
})
