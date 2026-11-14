import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileLogger, LOG_FILE_NAME } from '@main/logging/file-logger'

describe('FileLogger', () => {
  let dir: string

  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'droid-or-logger-')), 'logs')
  })

  afterEach(() => {
    rmSync(join(dir, '..'), { recursive: true, force: true })
  })

  const read = (name = LOG_FILE_NAME) => readFileSync(join(dir, name), 'utf-8')

  it('creates the directory and appends timestamped lines', () => {
    const logger = new FileLogger(dir)
    logger.info('started')
    logger.warn('careful')
    const lines = read().trimEnd().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z INFO {2}started$/)
    expect(lines[1]).toMatch(/ WARN {2}careful$/)
  })

  it('includes the stack of an error', () => {
    const logger = new FileLogger(dir)
    logger.error('boom', new Error('kaput'))
    expect(read()).toMatch(/ERROR boom\nError: kaput\n\s+at /)
  })

  it('rotates by size and keeps at most maxFiles files', () => {
    const logger = new FileLogger(dir, { maxBytes: 200, maxFiles: 3 })
    for (let i = 0; i < 50; i++) {
      logger.info(`line ${i} ${'x'.repeat(40)}`)
    }
    expect(readdirSync(dir).sort()).toEqual(['droid-or.1.log', 'droid-or.2.log', 'droid-or.log'])
    for (const name of readdirSync(dir)) {
      expect(statSync(join(dir, name)).size).toBeLessThanOrEqual(200)
    }
    expect(read()).toContain('line 49')
  })

  it('never throws when the log directory disappears', () => {
    const logger = new FileLogger(dir)
    rmSync(dir, { recursive: true, force: true })
    expect(() => logger.error('still fine', new Error('x'))).not.toThrow()
  })
})
