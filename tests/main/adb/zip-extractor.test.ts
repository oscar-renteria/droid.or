import { createWriteStream } from 'node:fs'
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ZipFile } from 'yazl'
import { extractZip, resolveSafeEntryPath } from '@main/adb/zip-extractor'

async function writeZip(destPath: string, build: (zipfile: ZipFile) => void): Promise<void> {
  const zipfile = new ZipFile()
  build(zipfile)
  await new Promise<void>((resolvePromise, reject) => {
    zipfile.outputStream
      .pipe(createWriteStream(destPath))
      .on('close', () => resolvePromise())
      .on('error', reject)
    zipfile.end()
  })
}

describe('resolveSafeEntryPath', () => {
  it('resolves a normal nested entry inside destDir', () => {
    const result = resolveSafeEntryPath('/tmp/dest', 'platform-tools/adb')
    expect(result).toBe(resolve('/tmp/dest', 'platform-tools', 'adb'))
  })

  it('refuses an entry that traverses above destDir', () => {
    expect(() => resolveSafeEntryPath('/tmp/dest', '../../etc/passwd')).toThrow(
      /outside the target directory/
    )
  })

  it('refuses an absolute-path entry that escapes destDir entirely', () => {
    expect(() => resolveSafeEntryPath('/tmp/dest', '/etc/passwd')).toThrow(
      /outside the target directory/
    )
  })
})

describe('extractZip', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'droid-or-zip-extractor-test-'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  it('extracts nested files, preserving content', async () => {
    const zipPath = join(workDir, 'test.zip')
    const destDir = join(workDir, 'out')

    await writeZip(zipPath, (zipfile) => {
      zipfile.addBuffer(Buffer.from('hello adb'), 'platform-tools/adb')
      zipfile.addBuffer(Buffer.from('notice text'), 'platform-tools/NOTICE.txt')
    })

    await extractZip(zipPath, destDir)

    expect((await readFile(join(destDir, 'platform-tools', 'adb'))).toString()).toBe('hello adb')
    expect((await readFile(join(destDir, 'platform-tools', 'NOTICE.txt'))).toString()).toBe(
      'notice text'
    )
  })

  // Windows has no POSIX permission bits to restore.
  it.skipIf(process.platform === 'win32')(
    'restores the executable bit recorded in the archive',
    async () => {
      const zipPath = join(workDir, 'test.zip')
      const destDir = join(workDir, 'out')

      await writeZip(zipPath, (zipfile) => {
        zipfile.addBuffer(Buffer.from('#!/bin/sh\n'), 'platform-tools/adb', { mode: 0o100755 })
      })

      await extractZip(zipPath, destDir)

      const { mode } = await stat(join(destDir, 'platform-tools', 'adb'))
      expect(mode & 0o777).toBe(0o755)
    }
  )

  it('refuses an archive with two entries resolving to the same destination path', async () => {
    const zipPath = join(workDir, 'test.zip')
    const destDir = join(workDir, 'out')

    await writeZip(zipPath, (zipfile) => {
      zipfile.addBuffer(Buffer.from('first'), 'app.apk')
      zipfile.addBuffer(Buffer.from('second'), 'app.apk')
    })

    await expect(extractZip(zipPath, destDir)).rejects.toThrow(/duplicate entry/)
  })

  it('only extracts entries shouldExtract accepts, reporting the rest as skipped', async () => {
    const zipPath = join(workDir, 'test.zip')
    const destDir = join(workDir, 'out')

    await writeZip(zipPath, (zipfile) => {
      zipfile.addBuffer(Buffer.from('apk bytes'), 'base.apk')
      zipfile.addBuffer(Buffer.from('icon bytes'), 'icon.png')
      zipfile.addBuffer(Buffer.from('{}'), 'manifest.json')
    })

    const result = await extractZip(zipPath, destDir, {
      shouldExtract: (entryFileName) => entryFileName.endsWith('.apk')
    })

    expect((await readFile(join(destDir, 'base.apk'))).toString()).toBe('apk bytes')
    await expect(stat(join(destDir, 'icon.png'))).rejects.toThrow()
    expect(result.skippedEntries.sort()).toEqual(['icon.png', 'manifest.json'])
  })

  it('extracts everything and reports no skipped entries when shouldExtract is omitted', async () => {
    const zipPath = join(workDir, 'test.zip')
    const destDir = join(workDir, 'out')

    await writeZip(zipPath, (zipfile) => {
      zipfile.addBuffer(Buffer.from('apk bytes'), 'base.apk')
    })

    const result = await extractZip(zipPath, destDir)

    expect(result.skippedEntries).toEqual([])
  })

  it('refuses to extract once the cumulative uncompressed size exceeds the configured cap', async () => {
    const zipPath = join(workDir, 'test.zip')
    const destDir = join(workDir, 'out')

    await writeZip(zipPath, (zipfile) => {
      zipfile.addBuffer(Buffer.from('x'.repeat(1000)), 'first.apk')
      zipfile.addBuffer(Buffer.from('x'.repeat(1000)), 'second.apk')
    })

    await expect(extractZip(zipPath, destDir, { maxTotalUncompressedBytes: 1500 })).rejects.toThrow(
      /larger than expected/
    )
  })
})
