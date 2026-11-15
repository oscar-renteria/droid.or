// @vitest-environment jsdom
import type { DroidorApi } from '@shared/types/droidor-api'
import type { DeviceDashboardInfo } from '@shared/types/device-dashboard'
import type { KnownDevice } from '@shared/validation/device.schema'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TargetDeviceStrip from '@renderer/components/install/TargetDeviceStrip.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'

const DEVICE: KnownDevice = {
  id: 'device-1',
  nickname: null,
  manufacturer: 'Google',
  model: 'Pixel 9',
  androidVersion: '15',
  sdkVersion: 35,
  connectionState: 'device',
  firstSeenAt: '2026-10-10T10:00:00.000Z',
  lastConnectedAt: '2026-10-10T10:00:00.000Z'
}

const DASHBOARD_INFO: DeviceDashboardInfo = {
  deviceId: DEVICE.id,
  fetchedAt: '2026-10-10T10:00:00.000Z',
  basic: {
    manufacturer: 'Google',
    model: 'Pixel 9',
    deviceName: 'Pixel 9',
    androidVersion: '15',
    sdkVersion: 35,
    buildNumber: null,
    securityPatch: null,
    kernelVersion: null,
    cpuAbi: 'arm64-v8a',
    bootloaderState: 'locked',
    rootHeuristic: 'unlikely',
    usbDebuggingEnabled: true
  },
  hardware: {
    cpuCoreCount: null,
    ramTotalMb: null,
    ramAvailableMb: null,
    storageTotalMb: 128000,
    storageAvailableMb: 10240,
    batteryPercent: null,
    batteryTemperatureCelsius: null,
    batteryHealth: null,
    screenResolution: null,
    refreshRateHz: null,
    displayDensityDpi: null
  },
  system: {
    uptimeSeconds: null,
    selinuxStatus: null,
    encryptionState: null,
    encryptionType: null,
    abUpdate: null,
    activeSlot: null
  }
}

describe('TargetDeviceStrip', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows dashboard details and links to Overview', async () => {
    const getDeviceDashboardInfo = vi.fn().mockResolvedValue(DASHBOARD_INFO)
    vi.stubGlobal('window', {
      ...window,
      droidor: { getDeviceDashboardInfo } as unknown as DroidorApi
    })

    const devicesStore = useDevicesStore()
    devicesStore.$patch({ devices: [DEVICE], selectedDeviceId: DEVICE.id })
    const wrapper = mount(TargetDeviceStrip, {
      global: { stubs: { RouterLink: RouterLinkStub } }
    })

    expect(wrapper.text()).toContain('Loading device details')
    await flushPromises()

    expect(getDeviceDashboardInfo).toHaveBeenCalledWith(DEVICE.id)
    expect(wrapper.text()).toContain('Pixel 9')
    expect(wrapper.text()).toContain('15')
    expect(wrapper.text()).toContain('35')
    expect(wrapper.text()).toContain('arm64-v8a')
    expect(wrapper.text()).toContain('10.0 GB')
    expect(wrapper.getComponent(RouterLinkStub).props('to')).toEqual({ name: 'overview' })
  })

  it('surfaces dashboard IPC failures', async () => {
    const getDeviceDashboardInfo = vi.fn().mockRejectedValue(new Error('ADB is unavailable'))
    vi.stubGlobal('window', {
      ...window,
      droidor: { getDeviceDashboardInfo } as unknown as DroidorApi
    })

    const devicesStore = useDevicesStore()
    devicesStore.$patch({ devices: [DEVICE], selectedDeviceId: DEVICE.id })
    const wrapper = mount(TargetDeviceStrip, {
      global: { stubs: { RouterLink: RouterLinkStub } }
    })

    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe('ADB is unavailable')
  })
})
