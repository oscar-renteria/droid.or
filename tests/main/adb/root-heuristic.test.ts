import { describe, expect, it } from 'vitest'
import { evaluateRootHeuristic } from '@main/adb/root-heuristic'

describe('evaluateRootHeuristic', () => {
  it('reports unlikely for a stock production build (matches real device signals)', () => {
    const verdict = evaluateRootHeuristic({
      buildTags: 'release-keys',
      debuggable: '0',
      secure: '1',
      suProbeOutput: ''
    })
    expect(verdict).toBe('unlikely')
  })

  it('reports likely when a su binary is found, regardless of other signals', () => {
    const verdict = evaluateRootHeuristic({
      buildTags: 'release-keys',
      debuggable: '0',
      secure: '1',
      suProbeOutput: '/system/bin/su\n'
    })
    expect(verdict).toBe('likely')
  })

  it('reports likely for an eng/userdebug build (debuggable + insecure)', () => {
    const verdict = evaluateRootHeuristic({
      buildTags: 'release-keys',
      debuggable: '1',
      secure: '0',
      suProbeOutput: null
    })
    expect(verdict).toBe('likely')
  })

  it('reports possible (not likely) for test-keys alone', () => {
    const verdict = evaluateRootHeuristic({
      buildTags: 'test-keys',
      debuggable: '0',
      secure: '1',
      suProbeOutput: null
    })
    expect(verdict).toBe('possible')
  })
})
