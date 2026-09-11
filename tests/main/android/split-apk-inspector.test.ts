import { createWriteStream } from 'node:fs'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ZipFile } from 'yazl'
import type { RawApkInfo } from '@main/android/apk-parser-loader'
import {
  cleanupSplitSource,
  isSupportedSplitArchive,
  resolveSplitSource
} from '@main/android/split-apk-inspector'

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

const BASE_RAW: RawApkInfo = {
  package: 'com.example.app',
  versionName: '2.1.0',
  versionCode: 210,
  usesSdk: { minSdkVersion: 24, targetSdkVersion: 34 },
  application: { label: ['Example App'] }
}

const CONFIG_SPLIT_RAW: RawApkInfo = {
  package: 'com.example.app',
  versionName: null,
  versionCode: 210,
  usesSdk: null,
  application: {}
}

function fakeParser(
  responses: Record<string, RawApkInfo | Error>
): (path: string) => Promise<RawApkInfo> {
  return async (path: string) => {
    const fileName = path.split('/').pop() ?? path
    const response = responses[fileName]
    if (response instanceof Error) {
      throw response
    }
    if (!response) {
      throw new Error(`fakeParser: no response configured for "${fileName}"`)
    }
    return response
  }
}

describe('isSupportedSplitArchive', () => {
  it.each(['bundle.apks', 'bundle.xapk', 'bundle.apkm', 'BUNDLE.APKM'])(
    'accepts %s',
    (fileName) => {
      expect(isSupportedSplitArchive(fileName)).toBe(true)
    }
  )

  it.each(['app.apk', 'app.zip', 'app'])('rejects %s', (fileName) => {
    expect(isSupportedSplitArchive(fileName)).toBe(false)
  })
})

describe('resolveSplitSource', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'droid-or-split-inspector-test-'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  describe("sourceKind: 'files'", () => {
    it('inspects each given file independently, in the given order', async () => {
      const basePath = join(workDir, 'base.apk')
      const splitPath = join(workDir, 'split_config.arm64_v8a.apk')
      await writeFile(basePath, 'x')
      await writeFile(splitPath, 'x')

      const result = await resolveSplitSource(
        'files',
        [basePath, splitPath],
        fakeParser({ 'base.apk': BASE_RAW, 'split_config.arm64_v8a.apk': CONFIG_SPLIT_RAW })
      )

      expect(result.cleanupDir).toBeNull()
      expect(result.parts).toHaveLength(2)
      expect(result.parts[0]).toMatchObject({
        fileName: 'base.apk',
        packageName: 'com.example.app'
      })
      expect(result.parts[1]).toMatchObject({
        fileName: 'split_config.arm64_v8a.apk',
        versionName: null
      })
    })

    it('keeps a file that fails to parse, with parseError set, rather than throwing', async () => {
      const basePath = join(workDir, 'base.apk')
      await writeFile(basePath, 'x')

      const result = await resolveSplitSource(
        'files',
        [basePath],
        fakeParser({ 'base.apk': new Error('not a zip file') })
      )

      expect(result.parts).toEqual([
        expect.objectContaining({
          fileName: 'base.apk',
          packageName: null,
          parseError: 'not a zip file'
        })
      ])
    })
  })

  describe("sourceKind: 'directory'", () => {
    it('discovers and inspects every .apk file in the folder', async () => {
      await writeFile(join(workDir, 'base.apk'), 'x')
      await writeFile(join(workDir, 'split_config.en.apk'), 'x')
      await writeFile(join(workDir, 'readme.txt'), 'x')

      const result = await resolveSplitSource(
        'directory',
        [workDir],
        fakeParser({ 'base.apk': BASE_RAW, 'split_config.en.apk': CONFIG_SPLIT_RAW })
      )

      expect(result.cleanupDir).toBeNull()
      expect(result.parts.map((part) => part.fileName).sort()).toEqual([
        'base.apk',
        'split_config.en.apk'
      ])
    })

    it('throws when the folder has no .apk files', async () => {
      await writeFile(join(workDir, 'readme.txt'), 'x')

      await expect(resolveSplitSource('directory', [workDir])).rejects.toThrow(
        /No \.apk files were found in that folder/
      )
    })
  })

  describe("sourceKind: 'archive'", () => {
    it('extracts a .apks archive to a temp dir and inspects the apks inside it', async () => {
      const archivePath = join(workDir, 'bundle.apks')
      await writeZip(archivePath, (zipfile) => {
        zipfile.addBuffer(Buffer.from('base content'), 'splits/base-master.apk')
        zipfile.addBuffer(Buffer.from('split content'), 'splits/base-arm64_v8a.apk')
        zipfile.addBuffer(Buffer.from('toc'), 'toc.pb')
      })

      const result = await resolveSplitSource(
        'archive',
        [archivePath],
        fakeParser({
          'base-master.apk': BASE_RAW,
          'base-arm64_v8a.apk': CONFIG_SPLIT_RAW
        })
      )

      expect(result.cleanupDir).not.toBeNull()
      expect(result.parts.map((part) => part.fileName).sort()).toEqual([
        'base-arm64_v8a.apk',
        'base-master.apk'
      ])
      // The extracted temp dir should actually exist until cleanup runs.
      await expect(access(result.cleanupDir as string)).resolves.toBeUndefined()

      await cleanupSplitSource(result.cleanupDir)
      await expect(access(result.cleanupDir as string)).rejects.toThrow()
    })

    it('rejects an unsupported archive extension', async () => {
      const archivePath = join(workDir, 'bundle.zip')
      await writeFile(archivePath, 'x')

      await expect(resolveSplitSource('archive', [archivePath])).rejects.toThrow(
        /Only \.apks, \.xapk, and \.apkm archives are supported/
      )
    })

    it('throws and cleans up its temp dir when the archive contains no .apk files', async () => {
      const archivePath = join(workDir, 'bundle.xapk')
      await writeZip(archivePath, (zipfile) => {
        zipfile.addBuffer(Buffer.from('icon'), 'icon.png')
      })

      await expect(resolveSplitSource('archive', [archivePath])).rejects.toThrow(
        /No \.apk files were found inside that archive/
      )
    })
  })
})

describe('cleanupSplitSource', () => {
  it('does nothing when given null', async () => {
    await expect(cleanupSplitSource(null)).resolves.toBeUndefined()
  })

  it('removes the given directory recursively', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'droid-or-split-cleanup-test-'))
    await mkdir(join(dir, 'nested'))
    await writeFile(join(dir, 'nested', 'file.txt'), 'x')

    await cleanupSplitSource(dir)

    await expect(access(dir)).rejects.toThrow()
  })
})
