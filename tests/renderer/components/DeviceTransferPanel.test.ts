// @vitest-environment jsdom
import type { KnownDevice } from '@shared/types/device'
import { NSelect } from 'naive-ui'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import DeviceTransferPanel from '@renderer/components/install/DeviceTransferPanel.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'

const TARGET: KnownDevice = {
  id: 'target',
  nickname: null,
  manufacturer: 'Google',
  model: 'Pixel 9',
  androidVersion: '15',
  sdkVersion: 35,
  connectionState: 'device',
  firstSeenAt: '2026-10-10T10:00:00.000Z',
  lastConnectedAt: '2026-10-10T10:00:00.000Z'
}

const SOURCE: KnownDevice = {
  ...TARGET,
  id: 'source',
  manufacturer: 'Samsung',
  model: 'Galaxy S24'
}

const DISCONNECTED: KnownDevice = {
  ...TARGET,
  id: 'disconnected',
  manufacturer: 'Google',
  model: 'Pixel 8',
  connectionState: 'disconnected'
}

describe('DeviceTransferPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('asks for a second device when only the target is connected', () => {
    const devicesStore = useDevicesStore()
    devicesStore.$patch({ devices: [TARGET], selectedDeviceId: TARGET.id })

    const wrapper = mount(DeviceTransferPanel)

    expect(wrapper.text()).toContain('Connect a second device')
    expect(wrapper.findComponent(NSelect).exists()).toBe(false)
  })

  it('offers connected devices other than the target and explains transfer limits', () => {
    const devicesStore = useDevicesStore()
    devicesStore.$patch({
      devices: [TARGET, SOURCE, DISCONNECTED],
      selectedDeviceId: TARGET.id
    })

    const wrapper = mount(DeviceTransferPanel)
    const sourceSelect = wrapper.getComponent(NSelect)

    expect(sourceSelect.props('options')).toEqual([
      { label: 'Samsung Galaxy S24', value: SOURCE.id }
    ])
    expect(wrapper.text()).toContain('to Google Pixel 9')
    expect(wrapper.text()).toContain('Only user-installed apps are listed.')
    expect(wrapper.text()).toContain('Google Play licensing or integrity checks')
  })
})
