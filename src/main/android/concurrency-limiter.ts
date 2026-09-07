/** A minimal async semaphore: at most `maxConcurrent` tasks passed to run()
 *  execute at once, others wait their turn. Used to keep APK pulls from
 *  saturating the single USB connection to a device when many packages'
 *  icons are requested around the same time. */
export class ConcurrencyLimiter {
  private active = 0
  private readonly queue: Array<() => void> = []

  constructor(private readonly maxConcurrent: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.active += 1
    try {
      return await task()
    } finally {
      this.active -= 1
      this.queue.shift()?.()
    }
  }
}
