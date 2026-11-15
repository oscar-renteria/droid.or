// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import DeviceGate from '@renderer/components/ui/DeviceGate.vue'

describe('DeviceGate', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('uses the supplied waiting title and setup guidance when no device is selected', () => {
    const wrapper = mount(DeviceGate, {
      props: {
        requirement: 'A device is required.',
        noDeviceTitle: 'Waiting for device…',
        noDeviceText: 'Enable USB debugging and connect your phone.'
      }
    })

    expect(wrapper.get('h1').text()).toBe('Waiting for device…')
    expect(wrapper.get('p').text()).toBe('Enable USB debugging and connect your phone.')
  })
})
