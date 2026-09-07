import { createWriteStream } from 'node:fs'
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    expect(result).toBe('/tmp/dest/platform-tools/adb')
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

  it('restores the executable bit recorded in the archive', async () => {
    const zipPath = join(workDir, 'test.zip')
    const destDir = join(workDir, 'out')

    await writeZip(zipPath, (zipfile) => {
      zipfile.addBuffer(Buffer.from('#!/bin/sh\n'), 'platform-tools/adb', { mode: 0o100755 })
    })

    await extractZip(zipPath, destDir)

    const { mode } = await stat(join(destDir, 'platform-tools', 'adb'))
    expect(mode & 0o777).toBe(0o755)
  })
})
