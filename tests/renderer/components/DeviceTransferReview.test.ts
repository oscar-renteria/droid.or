// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { SplitInstallAnalysis } from '@shared/types/split-install'
import type { KnownDevice } from '@shared/types/device'
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
    const performDeviceTransfer = vi
      .fn()
      .mockResolvedValue({ success: true, message: 'Installed', rawOutput: 'Success' })
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

    expect(analyzeDeviceTransfer).toHaveBeenCalledWith(SOURCE, TARGET, PACKAGE_NAME)
    expect(wrapper.text()).toContain('Example App')
    expect(wrapper.text()).toContain('New install')

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(performDeviceTransfer).toHaveBeenCalledWith(SOURCE, TARGET, PACKAGE_NAME, 7)
    expect(wrapper.text()).toContain('Copied')
    expect(wrapper.text()).toContain('Installed')
  })
})
