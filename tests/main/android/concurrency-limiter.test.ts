import { describe, expect, it } from 'vitest'
import { ConcurrencyLimiter } from '@main/android/concurrency-limiter'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('ConcurrencyLimiter', () => {
  it('never runs more than maxConcurrent tasks at once', async () => {
    const limiter = new ConcurrencyLimiter(2)
    let active = 0
    let maxObservedActive = 0
    const gates = [deferred<void>(), deferred<void>(), deferred<void>(), deferred<void>()]

    const runs = gates.map((gate, index) =>
      limiter.run(async () => {
        active += 1
        maxObservedActive = Math.max(maxObservedActive, active)
        await gate.promise
        active -= 1
        return index
      })
    )

    // Let the first batch actually start.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(maxObservedActive).toBe(2)

    gates[0]?.resolve()
    gates[1]?.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    gates[2]?.resolve()
    gates[3]?.resolve()

    const results = await Promise.all(runs)
    expect(results).toEqual([0, 1, 2, 3])
    expect(maxObservedActive).toBe(2)
  })

  it('propagates a task rejection without breaking the limiter for later tasks', async () => {
    const limiter = new ConcurrencyLimiter(1)

    await expect(limiter.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom')

    // The limiter must still work after a failure.
    const result = await limiter.run(() => Promise.resolve('ok'))
    expect(result).toBe('ok')
  })
})
