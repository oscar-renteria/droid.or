/** Prefers "Override" over "Physical" for both size and density: a developer
 *  can force an override value via `wm size`/`wm density`, and when set,
 *  that's what's actually active on screen. */
export function parseWmSize(output: string): string | null {
  const overrideMatch = /Override size:\s*(\d+x\d+)/.exec(output)
  if (overrideMatch?.[1]) {
    return overrideMatch[1]
  }
  const physicalMatch = /Physical size:\s*(\d+x\d+)/.exec(output)
  return physicalMatch?.[1] ?? null
}

export function parseWmDensity(output: string): number | null {
  const overrideMatch = /Override density:\s*(\d+)/.exec(output)
  if (overrideMatch?.[1]) {
    return Number.parseInt(overrideMatch[1], 10)
  }
  const physicalMatch = /Physical density:\s*(\d+)/.exec(output)
  return physicalMatch?.[1] ? Number.parseInt(physicalMatch[1], 10) : null
}

/**
 * Best-effort only — verified against a real (foldable) device that
 * `dumpsys display` text format is not internally consistent: it contains
 * two unrelated mode-numbering schemes (a per-display "modeId" and a
 * separate global "DisplayMode{id=...}" list) that happen to overlap
 * numerically without corresponding to the same mode, so cross-referencing
 * an id between them silently gives a wrong value. `renderFrameRate` sits
 * directly next to `modeId` inside the same DisplayDeviceInfo block, so it
 * is used as-is with no cross-referencing. Returns null (shown as
 * "Not available") rather than guessing when the field is absent, which is
 * expected on older Android versions that predate this field.
 */
export function parseActiveRefreshRateHz(output: string): number | null {
  const match = /renderFrameRate\s+([\d.]+)/.exec(output)
  if (!match?.[1]) {
    return null
  }
  const rate = Number.parseFloat(match[1])
  return Number.isFinite(rate) ? Math.round(rate) : null
}
