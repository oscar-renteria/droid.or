import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const script = fileURLToPath(new URL('../../scripts/acquisition-metrics.mjs', import.meta.url))
let root: string | undefined

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = undefined
})

/** A fake `gh` that answers `gh api <path>` from fixture files and fails
 *  traffic calls the way GitHub does without push access. */
function installFakeGh(dir: string, responses: Record<string, unknown>): string {
  const binDir = join(dir, 'bin')
  const fixtureDir = join(dir, 'fixtures')
  mkdirSync(binDir)
  mkdirSync(fixtureDir)
  const index: Record<string, string> = {}
  Object.entries(responses).forEach(([path, body], i) => {
    const file = join(fixtureDir, `${i}.json`)
    writeFileSync(file, JSON.stringify(body))
    index[path] = file
  })
  writeFileSync(join(fixtureDir, 'index.json'), JSON.stringify(index))
  const fake = join(binDir, 'gh')
  writeFileSync(
    fake,
    `#!/usr/bin/env node
const { readFileSync } = require('node:fs')
const index = JSON.parse(readFileSync(${JSON.stringify(join(fixtureDir, 'index.json'))}, 'utf8'))
const file = index[process.argv[3]]
if (!file) { process.stderr.write('gh: Resource not accessible by integration (HTTP 403)'); process.exit(1) }
process.stdout.write(readFileSync(file, 'utf8'))
`
  )
  chmodSync(fake, 0o755)
  return binDir
}

function run(binDir: string, args: string[]): string {
  return execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}` }
  })
}

// The fake `gh` is an extensionless shebang script, which Windows can't
// execute; the script itself only shells out to the real gh(.exe) there.
const itWithFakeGh = it.skipIf(process.platform === 'win32')

describe('acquisition-metrics', () => {
  itWithFakeGh('saves downloads per release, excluding drafts, even without traffic access', () => {
    root = mkdtempSync(join(tmpdir(), 'droid-or-metrics-'))
    const binDir = installFakeGh(root, {
      'repos/owner/app': {
        stargazers_count: 7,
        forks_count: 2,
        subscribers_count: 3,
        open_issues_count: 1
      },
      'repos/owner/app/releases?per_page=100': [
        {
          tag_name: 'v1.1.0',
          draft: true,
          published_at: null,
          prerelease: false,
          assets: [{ name: 'draft.exe', download_count: 99 }]
        },
        {
          tag_name: 'v1.0.0',
          draft: false,
          published_at: '2026-11-19T10:00:00Z',
          prerelease: false,
          assets: [
            { name: 'setup.exe', download_count: 10 },
            { name: 'app.AppImage', download_count: 5 }
          ]
        }
      ]
    })
    const outDir = join(root, 'out')

    const output = run(binDir, ['--repo', 'owner/app', '--out', outDir])

    const files = readdirSync(outDir)
    expect(files).toHaveLength(1)
    const file = files[0] ?? ''
    expect(file).toMatch(/^\d{4}-\d{2}-\d{2}\.json$/)
    const snapshot = JSON.parse(readFileSync(join(outDir, file), 'utf8'))
    expect(snapshot).toMatchObject({
      repository: 'owner/app',
      stars: 7,
      forks: 2,
      watchers: 3,
      openIssues: 1,
      totalDownloads: 15,
      releases: [
        {
          tag: 'v1.0.0',
          downloads: 15,
          assets: [
            { name: 'setup.exe', downloads: 10 },
            { name: 'app.AppImage', downloads: 5 }
          ]
        }
      ]
    })
    expect(snapshot.traffic.views.error).toContain('HTTP 403')
    expect(output).toContain('Downloads total: 15')
    expect(output).toContain('Traffic: unavailable')
  })

  itWithFakeGh('records traffic and top referrers when available', () => {
    root = mkdtempSync(join(tmpdir(), 'droid-or-metrics-'))
    const binDir = installFakeGh(root, {
      'repos/owner/app': {
        stargazers_count: 0,
        forks_count: 0,
        subscribers_count: 0,
        open_issues_count: 0
      },
      'repos/owner/app/releases?per_page=100': [],
      'repos/owner/app/traffic/views': { count: 40, uniques: 12, views: [] },
      'repos/owner/app/traffic/clones': { count: 3, uniques: 2, clones: [] },
      'repos/owner/app/traffic/popular/referrers': [
        { referrer: 'news.ycombinator.com', count: 30, uniques: 9 }
      ],
      'repos/owner/app/traffic/popular/paths': []
    })

    const output = run(binDir, ['--repo', 'owner/app', '--out', join(root, 'out')])

    expect(output).toContain('Views (14 days): 40 (12 unique)')
    expect(output).toContain('news.ycombinator.com: 30 (9 unique)')
  })

  it('rejects a malformed repository name', () => {
    expect(() =>
      execFileSync(process.execPath, [script, '--repo', 'not a repo'], { stdio: 'pipe' })
    ).toThrow(/owner\/name/)
  })
})
