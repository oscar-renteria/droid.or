// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOAST_DEDUPE_MS, toReport, useErrorReportStore } from '@renderer/stores/error-report.store'

describe('toReport', () => {
  it('keeps message and stack of an Error', () => {
    const error = new Error('render failed')
    expect(toReport(error, 'vue', 'render function')).toEqual({
      source: 'vue',
      message: 'render failed',
      stack: error.stack,
      info: 'render function'
    })
  })

  it('stringifies non-Error values and truncates oversized fields', () => {
    expect(toReport('plain', 'unhandled-rejection')).toMatchObject({
      message: 'plain',
      stack: null
    })
    const long = toReport(new Error('x'.repeat(5_000)), 'window-error')
    expect(long.message).toHaveLength(2_000)
    expect(long.message.endsWith('…')).toBe(true)
  })
})

describe('useErrorReportStore', () => {
  let logRendererError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    logRendererError = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('droidor', { logRendererError })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs every report and raises a notice', () => {
    const store = useErrorReportStore()
    store.report(new Error('boom'), 'vue', 'setup function', 1_000)
    expect(logRendererError).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'vue', message: 'boom', info: 'setup function' })
    )
    expect(store.latestNotice).toEqual({ id: 1, message: 'boom' })
  })

  it('logs repeats but toasts the same message once per window', () => {
    const store = useErrorReportStore()
    store.report(new Error('boom'), 'vue', null, 1_000)
    store.report(new Error('boom'), 'vue', null, 1_000 + TOAST_DEDUPE_MS - 1)
    expect(store.latestNotice?.id).toBe(1)
    store.report(new Error('boom'), 'vue', null, 1_000 + TOAST_DEDUPE_MS)
    expect(store.latestNotice?.id).toBe(2)
    expect(logRendererError).toHaveBeenCalledTimes(3)
  })

  it('never throws when logging fails or the bridge is missing', async () => {
    logRendererError.mockRejectedValue(new Error('ipc down'))
    const store = useErrorReportStore()
    expect(() => store.report(new Error('a'), 'window-error')).not.toThrow()
    vi.unstubAllGlobals()
    expect(() => store.report(new Error('b'), 'window-error')).not.toThrow()
    expect(store.latestNotice?.message).toBe('b')
  })
})
