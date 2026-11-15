import type { RendererErrorReport } from '@shared/validation/renderer-error.schema'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** The same message within this window produces one toast, not a stack. */
export const TOAST_DEDUPE_MS = 5_000

export interface ErrorNotice {
  id: number
  message: string
}

function truncate(value: string | null, max: number): string | null {
  return value === null ? null : value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function toReport(
  error: unknown,
  source: RendererErrorReport['source'],
  info: string | null = null
): RendererErrorReport {
  const message =
    error instanceof Error ? error.message || error.name : String(error ?? 'Unknown error')
  const stack = error instanceof Error ? (error.stack ?? null) : null
  return {
    source,
    message: truncate(message, 2_000) ?? '',
    stack: truncate(stack, 10_000),
    info: truncate(info, 200)
  }
}

/**
 * Collects unexpected renderer errors: each is written to the persistent
 * log (via the main process) and surfaced as `latestNotice`, which
 * ErrorToaster.vue turns into a toast inside the themed message provider.
 */
export const useErrorReportStore = defineStore('errorReport', () => {
  const latestNotice = ref<ErrorNotice | null>(null)
  let nextId = 1
  const lastShownAt = new Map<string, number>()

  function report(
    error: unknown,
    source: RendererErrorReport['source'],
    info: string | null = null,
    now: number = Date.now()
  ): void {
    const payload = toReport(error, source, info)
    // Fire-and-forget: reporting an error must never raise another one.
    window.droidor?.logRendererError(payload).catch(() => {})

    const shownAt = lastShownAt.get(payload.message)
    if (shownAt !== undefined && now - shownAt < TOAST_DEDUPE_MS) {
      return
    }
    lastShownAt.set(payload.message, now)
    latestNotice.value = { id: nextId++, message: payload.message }
  }

  return { latestNotice, report }
})
