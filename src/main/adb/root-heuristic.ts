export type RootHeuristicVerdict = 'likely' | 'possible' | 'unlikely'

export interface RootHeuristicInput {
  /** ro.build.tags — "release-keys" on virtually every retail device,
   *  "test-keys" on custom/dev-signed builds. Does NOT reliably indicate
   *  root either way: a systemless Magisk install needs no custom build. */
  buildTags: string | null
  /** ro.debuggable ('1'/'0') */
  debuggable: string | null
  /** ro.secure ('1'/'0') */
  secure: string | null
  /** Raw stdout of a fixed, hard-coded su-binary path probe. Non-empty
   *  means a su binary was found at one of the checked paths. Deliberately
   *  never invokes su itself — doing so pops a visible grant dialog on the
   *  phone and can hang waiting for user interaction. */
  suProbeOutput: string | null
}

/**
 * No single reliable signal exists for root status without root itself, so
 * this combines several weak ones and reports a graded verdict rather than
 * a hard yes/no — the caller must present it as a heuristic, never as fact.
 */
export function evaluateRootHeuristic(input: RootHeuristicInput): RootHeuristicVerdict {
  if (input.suProbeOutput && input.suProbeOutput.trim().length > 0) {
    return 'likely'
  }
  if (input.debuggable === '1' && input.secure === '0') {
    return 'likely'
  }
  if (input.buildTags?.includes('test-keys')) {
    return 'possible'
  }
  return 'unlikely'
}

/** Fixed, hard-coded probe — never built from any user or device-supplied
 *  input — checked for common su install locations without invoking su. */
export const SU_PROBE_SHELL_COMMAND =
  'for p in /sbin/su /system/bin/su /system/xbin/su /data/local/xbin/su /data/local/bin/su /system/sbin/su /vendor/bin/su; do [ -e "$p" ] && echo "$p"; done'
