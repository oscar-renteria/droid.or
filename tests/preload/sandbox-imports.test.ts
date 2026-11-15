import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The preload runs with `sandbox: true`, where `require` resolves only
 * `electron` (plus a few polyfills). A Node built-in import doesn't fail
 * the build or any unit test — it makes the preload fail to load at
 * runtime, leaving the renderer without `window.droidor`.
 */
describe('preload sandbox compatibility', () => {
  it('imports no Node built-in modules', () => {
    const source = readFileSync(resolve('src/preload/index.ts'), 'utf8')
    const specifiers = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
    const builtins = new Set(builtinModules)
    const nodeImports = specifiers.filter(
      (specifier) =>
        specifier !== undefined && (specifier.startsWith('node:') || builtins.has(specifier))
    )
    expect(nodeImports).toEqual([])
  })
})
