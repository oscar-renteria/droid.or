// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { SplitInstallAnalysis } from '@shared/types/split-install'
import type { KnownDevice } from '@shared/types/device'
import type { OperationResult } from '@shared/types/operation'
import type { DeviceTransferProgressUpdate } from '@shared/validation/device-transfer.schema'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DeviceTransferReview from '@renderer/components/install/DeviceTransferReview.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'

const SOURCE = 'source-device'
const TARGET = 'target-device'
const PACKAGE_NAME = 'com.example.app'

function device(id: string): KnownDevice {
  return {
    id,
    nickname: null,
    manufacturer: 'Google',
    model: id,
    androidVersion: '15',
    sdkVersion: 35,
    connectionState: 'device',
    firstSeenAt: '2026-10-10T10:00:00.000Z',
    lastConnectedAt: '2026-10-10T10:00:00.000Z'
  }
}

const ANALYSIS: SplitInstallAnalysis = {
  sourceKind: 'directory',
  sourcePaths: ['/tmp/source-app'],
  packageName: PACKAGE_NAME,
  versionName: '1.0.0',
  versionCode: 7,
  label: 'Example App',
  iconDataUrl: null,
  devicePrimaryAbi: 'arm64-v8a',
  deviceDensityBucket: null,
  parts: [],
  issues: [],
  canInstall: true,
  plan: { operation: 'fresh-install', currentVersionCode: null }
}

describe('DeviceTransferReview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useDevicesStore().$patch({
      devices: [device(SOURCE), device(TARGET)],
      selectedDeviceId: TARGET
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('checks compatibility, reviews the result, and installs the reviewed app', async () => {
    const analyzeDeviceTransfer = vi.fn().mockResolvedValue(ANALYSIS)
    let reportProgress: ((progress: DeviceTransferProgressUpdate) => void) | undefined
    let resolveInstall: ((result: OperationResult) => void) | undefined
    const performDeviceTransfer = vi.fn(
      (
        _sourceDeviceId: string,
        _targetDeviceId: string,
        _packageName: string,
        _expectedVersionCode: number | null,
        onProgress?: (progress: DeviceTransferProgressUpdate) => void
      ) => {
        reportProgress = onProgress
        return new Promise<OperationResult>((resolve) => {
          resolveInstall = resolve
        })
      }
    )
    vi.stubGlobal(
      'window',
      Object.assign(Object.create(window), {
        droidor: { analyzeDeviceTransfer, performDeviceTransfer } as unknown as DroidorApi
      })
    )

    const wrapper = mount(DeviceTransferReview, {
      props: {
        sourceDeviceId: SOURCE,
        targetDeviceId: TARGET,
        packageName: PACKAGE_NAME,
        displayName: 'Example App'
      }
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(analyzeDeviceTransfer.mock.calls[0]?.slice(0, 3)).toEqual([SOURCE, TARGET, PACKAGE_NAME])
    expect(wrapper.text()).toContain('Example App')
    expect(wrapper.text()).toContain('New install')

    await wrapper.get('button').trigger('click')
    reportProgress?.({
      phase: 'pulling',
      fileName: 'split_config.arm64_v8a.apk',
      fileNumber: 2,
      totalFiles: 3
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain(
      'Copying file 2 of 3 from the source: split_config.arm64_v8a.apk'
    )

    reportProgress?.({ phase: 'installing', fileCount: 3 })
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Installing 3 file(s) on the target device')
    resolveInstall?.({ success: true, message: 'Installed', rawOutput: 'Success' })
    await flushPromises()

    expect(performDeviceTransfer.mock.calls[0]?.slice(0, 4)).toEqual([
      SOURCE,
      TARGET,
      PACKAGE_NAME,
      7
    ])
    expect(wrapper.text()).toContain('Copied')
    expect(wrapper.text()).toContain('Installed')
  })
})
