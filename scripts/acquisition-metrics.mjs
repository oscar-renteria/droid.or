// Takes a snapshot of droid.or's public adoption numbers: release downloads,
// stars/forks/watchers and (with push access) repository traffic.
//
// droid.or has no telemetry, so these GitHub numbers are the only adoption
// signal there is. GitHub keeps traffic data for 14 days only — run this at
// least every two weeks (weekly is better) or the history is lost.
//
// Usage: node scripts/acquisition-metrics.mjs [--out <dir>] [--repo owner/name]
//
// Requires an authenticated GitHub CLI (`gh auth login`). Each run writes
// <out>/<YYYY-MM-DD>.json (default out: .metrics/, git-ignored) and prints a
// short summary. Traffic needs push access to the repository; without it the
// snapshot records the error and still saves everything else.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DEFAULT_REPOSITORY = 'oscar-renteria/droid.or'

function parseArgs(argv) {
  const options = { out: '.metrics', repo: DEFAULT_REPOSITORY }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const value = argv[i + 1]
    if ((arg === '--out' || arg === '--repo') && value && !value.startsWith('--')) {
      options[arg.slice(2)] = value
      i += 1
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`)
    }
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(options.repo)) {
    throw new Error(`--repo must look like owner/name, got "${options.repo}".`)
  }
  return options
}

function ghApi(path) {
  const output = execFileSync('gh', ['api', path], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return JSON.parse(output)
}

/** Traffic endpoints fail without push access; keep the rest of the snapshot. */
function tryGhApi(path) {
  try {
    return ghApi(path)
  } catch (error) {
    const stderr = error?.stderr?.toString().trim()
    return { error: stderr || (error instanceof Error ? error.message : String(error)) }
  }
}

function summarizeReleases(releases) {
  return releases
    .filter((release) => !release.draft)
    .map((release) => {
      const assets = release.assets.map((asset) => ({
        name: asset.name,
        downloads: asset.download_count
      }))
      return {
        tag: release.tag_name,
        publishedAt: release.published_at,
        prerelease: release.prerelease,
        downloads: assets.reduce((sum, asset) => sum + asset.downloads, 0),
        assets
      }
    })
}

function takeSnapshot(repo) {
  const repository = ghApi(`repos/${repo}`)
  // 100 releases is far beyond this project's history; revisit if that changes.
  const releases = summarizeReleases(ghApi(`repos/${repo}/releases?per_page=100`))

  return {
    takenAt: new Date().toISOString(),
    repository: repo,
    stars: repository.stargazers_count,
    forks: repository.forks_count,
    watchers: repository.subscribers_count,
    openIssues: repository.open_issues_count,
    totalDownloads: releases.reduce((sum, release) => sum + release.downloads, 0),
    releases,
    traffic: {
      views: tryGhApi(`repos/${repo}/traffic/views`),
      clones: tryGhApi(`repos/${repo}/traffic/clones`),
      referrers: tryGhApi(`repos/${repo}/traffic/popular/referrers`),
      paths: tryGhApi(`repos/${repo}/traffic/popular/paths`)
    }
  }
}

function printSummary(snapshot, file) {
  const { views, referrers } = snapshot.traffic
  const lines = [
    `${snapshot.repository} — ${snapshot.takenAt}`,
    `Stars ${snapshot.stars} · forks ${snapshot.forks} · watchers ${snapshot.watchers} · open issues/PRs ${snapshot.openIssues}`,
    `Downloads total: ${snapshot.totalDownloads}`,
    ...snapshot.releases.map((release) => `  ${release.tag}: ${release.downloads}`),
    views.error
      ? `Traffic: unavailable (${views.error})`
      : `Views (14 days): ${views.count} (${views.uniques} unique)`
  ]
  if (Array.isArray(referrers) && referrers.length > 0) {
    lines.push('Top referrers (14 days):')
    for (const referrer of referrers.slice(0, 5)) {
      lines.push(`  ${referrer.referrer}: ${referrer.count} (${referrer.uniques} unique)`)
    }
  }
  lines.push(`Saved to ${file}`)
  console.log(lines.join('\n'))
}

try {
  const options = parseArgs(process.argv.slice(2))
  const snapshot = takeSnapshot(options.repo)
  const outDir = resolve(options.out)
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, `${snapshot.takenAt.slice(0, 10)}.json`)
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`)
  printSummary(snapshot, file)
} catch (error) {
  const stderr = error?.stderr?.toString().trim()
  console.error(
    `acquisition-metrics: ${stderr || (error instanceof Error ? error.message : error)}`
  )
  process.exitCode = 1
}
