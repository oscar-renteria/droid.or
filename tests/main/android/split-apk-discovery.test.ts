import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { discoverApkFiles } from '@main/android/split-apk-discovery'

describe('discoverApkFiles', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'droid-or-split-discovery-test-'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  it('finds .apk files directly inside the folder', async () => {
    await writeFile(join(workDir, 'base.apk'), 'x')
    await writeFile(join(workDir, 'config.en.apk'), 'x')
    await writeFile(join(workDir, 'readme.txt'), 'x')

    const found = await discoverApkFiles(workDir)

    expect(found.sort()).toEqual([join(workDir, 'base.apk'), join(workDir, 'config.en.apk')].sort())
  })

  it('ignores nested subdirectories by default (non-recursive)', async () => {
    const splitsDir = join(workDir, 'splits')
    await mkdir(splitsDir)
    await writeFile(join(splitsDir, 'base-master.apk'), 'x')
    await writeFile(join(workDir, 'toc.pb'), 'x')

    const found = await discoverApkFiles(workDir)

    expect(found).toEqual([])
  })

  it('finds .apk files nested in subdirectories when recursive is requested', async () => {
    const splitsDir = join(workDir, 'splits')
    await mkdir(splitsDir)
    await writeFile(join(splitsDir, 'base-master.apk'), 'x')
    await writeFile(join(workDir, 'toc.pb'), 'x')

    const found = await discoverApkFiles(workDir, true)

    expect(found).toEqual([join(splitsDir, 'base-master.apk')])
  })

  it('is case-insensitive about the .apk extension', async () => {
    await writeFile(join(workDir, 'Base.APK'), 'x')

    const found = await discoverApkFiles(workDir)

    expect(found).toEqual([join(workDir, 'Base.APK')])
  })

  it('returns an empty array when nothing matches', async () => {
    await writeFile(join(workDir, 'notes.md'), 'x')

    expect(await discoverApkFiles(workDir)).toEqual([])
  })

  it('returns results in a deterministic sorted order', async () => {
    await writeFile(join(workDir, 'z.apk'), 'x')
    await writeFile(join(workDir, 'a.apk'), 'x')
    await writeFile(join(workDir, 'm.apk'), 'x')

    const found = await discoverApkFiles(workDir)

    expect(found).toEqual([join(workDir, 'a.apk'), join(workDir, 'm.apk'), join(workDir, 'z.apk')])
  })
})
