/**
 * `adb install` output has not been verified against a real device this
 * session (none was connected while this was written) — these patterns
 * follow long-stable, widely documented adb behavior instead:
 *  - success: stdout contains a bare "Success" line, optionally preceded
 *    by "Performing Streamed Install".
 *  - a device-side rejection: "Failure [REASON]", either alone on stdout
 *    or wrapped as "adb: failed to install <path>: Failure [REASON]" on
 *    stderr depending on adb version.
 *  - a host-side failure before install was ever attempted (bad path,
 *    permissions): "adb: failed to stat <path>: <reason>".
 * The parser tries each in turn and falls back to the first non-empty
 * line rather than ever claiming a specific reason it didn't actually see.
 */
export function isInstallSuccessful(exitCode: number, stdout: string): boolean {
  return exitCode === 0 && /(^|\n)\s*Success\s*($|\n)/.test(stdout)
}

export function extractInstallFailureMessage(stdout: string, stderr: string): string {
  const combined = `${stdout}\n${stderr}`.trim()

  const bracketed = /Failure\s*\[(.+?)\]/.exec(combined)
  if (bracketed?.[1]) {
    return bracketed[1]
  }

  const failedToInstall = /adb: failed to install\s+\S+:\s*(.+)/.exec(combined)
  if (failedToInstall?.[1]) {
    return failedToInstall[1].trim()
  }

  const failedToStat = /adb: failed to stat\s+\S+:\s*(.+)/.exec(combined)
  if (failedToStat?.[1]) {
    return `File not accessible: ${failedToStat[1].trim()}`
  }

  const firstLine = combined
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  return firstLine ?? 'The install failed for an unknown reason.'
}
