/**
 * `--smoke-test` makes a packaged build prove it can actually start, then
 * exit: the release pipeline launches every distributable this way on its
 * own OS (see .github/workflows/build.yml). It covers what unit tests and
 * a successful electron-builder run can't — the native SQLite module
 * loading under the packaged Electron runtime, the preload bridge, and the
 * renderer bundle mounting from inside the archive.
 *
 * Kept free of Electron imports so the pass/fail logic is unit-testable;
 * main/index.ts supplies the real checks.
 */

export const SMOKE_TEST_FLAG = '--smoke-test'

/** Long enough for a cold Windows portable start (self-extraction to
 *  %TEMP%) on a shared CI runner; short enough to fail a hung start well
 *  before the job's own timeout. */
export const SMOKE_TEST_TIMEOUT_MS = 90_000

export function isSmokeTest(argv: readonly string[]): boolean {
  return argv.includes(SMOKE_TEST_FLAG)
}

export interface SmokeTestChecks {
  /** Runs a trivial query against the app's real database. */
  checkDatabase: () => void
  /** Resolves once the renderer has loaded, the preload API is exposed,
   *  and the Vue app has mounted; rejects if loading failed. */
  waitForRenderer: () => Promise<void>
  log: (message: string) => void
  exit: (code: number) => void
  timeoutMs?: number
}

export async function runSmokeTest(checks: SmokeTestChecks): Promise<void> {
  const { checkDatabase, waitForRenderer, log, exit } = checks
  const timeoutMs = checks.timeoutMs ?? SMOKE_TEST_TIMEOUT_MS
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out after ${timeoutMs} ms waiting for the app to start`)),
      timeoutMs
    )
  })

  try {
    checkDatabase()
    log('smoke test: database ok')
    await Promise.race([waitForRenderer(), timeout])
    log('smoke test: renderer ok')
    exit(0)
  } catch (error) {
    log(`smoke test FAILED: ${error instanceof Error ? error.message : String(error)}`)
    exit(1)
  } finally {
    clearTimeout(timer)
  }
}
