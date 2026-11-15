import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const script = fileURLToPath(
  new URL('../../scripts/generate-third-party-notices.mjs', import.meta.url)
)
let root: string | undefined

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = undefined
})

describe('generate-third-party-notices', () => {
  it('includes installed production dependencies and their license text only', () => {
    root = mkdtempSync(join(tmpdir(), 'droid-or-notices-'))
    const productionPath = join(root, 'node_modules/@scope/runtime')
    const devPath = join(root, 'node_modules/dev-only')
    mkdirSync(productionPath, { recursive: true })
    mkdirSync(devPath, { recursive: true })
    writeFileSync(
      join(root, 'package-lock.json'),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { name: 'fixture' },
          'node_modules/@scope/runtime': {
            name: '@scope/runtime',
            version: '1.2.3',
            license: 'MIT'
          },
          'node_modules/dev-only': {
            name: 'dev-only',
            version: '4.5.6',
            license: 'ISC',
            dev: true
          },
          'node_modules/not-installed': {
            name: 'not-installed',
            version: '7.8.9',
            license: 'Apache-2.0',
            optional: true
          }
        }
      })
    )
    writeFileSync(
      join(productionPath, 'package.json'),
      JSON.stringify({
        name: '@scope/runtime',
        version: '1.2.3',
        license: 'MIT',
        repository: 'https://example.com/runtime'
      })
    )
    writeFileSync(join(productionPath, 'LICENSE'), 'Runtime license text')
    writeFileSync(
      join(devPath, 'package.json'),
      JSON.stringify({ name: 'dev-only', version: '4.5.6', license: 'ISC' })
    )

    execFileSync(process.execPath, [script], { cwd: root })

    const notices = readFileSync(join(root, 'THIRD_PARTY_NOTICES.txt'), 'utf8')
    expect(notices).toContain('Package: @scope/runtime@1.2.3')
    expect(notices).toContain('License: MIT')
    expect(notices).toContain('Runtime license text')
    expect(notices).not.toContain('dev-only')
    expect(notices).not.toContain('not-installed')
  })
})
