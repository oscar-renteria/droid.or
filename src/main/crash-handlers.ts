import type { FileLogger } from './logging/file-logger'

export interface CrashHandlerDeps {
  logger: Pick<FileLogger, 'error' | 'directory'>
  /** Blocking error dialog (Electron's `dialog.showErrorBox`); omitted in
   *  smoke-test mode, where a modal would hang CI. */
  showError?: ((title: string, content: string) => void) | undefined
  /** Closes the database etc. Must not throw; called at most once. */
  closeResources: () => void
  exit: (code: number) => void
}

export interface ProcessLike {
  on(event: 'uncaughtException', listener: (error: Error) => void): unknown
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown
}

/**
 * - Uncaught exception: the main process's state can no longer be trusted
 *   (an ADB operation or a DB transaction may be half done), so it is
 *   logged, the user is told where the log is, resources are closed
 *   cleanly — SQLite flushes its WAL on close — and the app exits.
 * - Unhandled rejection: logged only. These are typically a forgotten
 *   `await` on a failed, already-reported operation; a modal for each
 *   would be noisier than useful, and Node no longer crashes on them
 *   only because this handler exists.
 */
export function installCrashHandlers(
  target: ProcessLike,
  deps: CrashHandlerDeps
): (error: unknown) => void {
  let crashed = false

  const fatal = (raw: unknown): void => {
    const error = raw instanceof Error ? raw : new Error(String(raw))
    deps.logger.error('Uncaught exception in main process', error)
    if (crashed) {
      return
    }
    crashed = true
    deps.showError?.(
      'droid.or ran into an unexpected error',
      `${error.message}\n\ndroid.or will close to protect your data. Details were saved to the log ` +
        `folder:\n${deps.logger.directory}\n\nPlease attach droid-or.log when reporting this issue.`
    )
    try {
      deps.closeResources()
    } finally {
      deps.exit(1)
    }
  }

  target.on('uncaughtException', fatal)
  target.on('unhandledRejection', (reason) => {
    deps.logger.error('Unhandled promise rejection in main process', reason)
  })

  /** For failures that must be fatal but arrive as a rejection, such as
   *  an error during startup. */
  return fatal
}
