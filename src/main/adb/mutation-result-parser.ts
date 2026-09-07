/**
 * Extracts a human-readable failure reason from a failed pm command.
 * Verified against a real device (using a nonexistent package name, so
 * nothing real was ever modified) that these commands do not agree on a
 * single format:
 *  - `pm disable-user` / `pm enable` print a raw Java exception dump to
 *    stderr (e.g. "Exception occurred while executing 'disable-user':\n
 *    java.lang.IllegalArgumentException: Unknown package: ...").
 *  - `pm uninstall` prints a clean "Failure [reason]" to stdout.
 *  - `pm clear` prints a bare "Failed" to stdout, with no reason at all.
 */
export function extractFailureMessage(stdout: string, stderr: string): string {
  const combined = `${stdout}\n${stderr}`.trim()

  const exceptionMatch = /Exception occurred while executing '[^']+':\s*\n?([^\n]+)/.exec(combined)
  if (exceptionMatch?.[1]) {
    return exceptionMatch[1].trim()
  }

  const failureWithReasonMatch = /Failure\s*\[(.+?)\]/.exec(combined)
  if (failureWithReasonMatch?.[1]) {
    return failureWithReasonMatch[1]
  }

  if (/\bfailed\b/i.test(combined)) {
    return 'The device reported that this operation failed, without giving a specific reason.'
  }

  const firstLine = combined
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  return firstLine ?? 'The operation failed for an unknown reason.'
}
