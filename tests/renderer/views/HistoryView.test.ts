// @vitest-environment jsdom
import type { KnownDevice } from '@shared/types/device'
import type { OperationHistoryEntry } from '@shared/types/operation'
import { NDataTable, type DataTableColumns } from 'naive-ui'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DroidorApi } from '@shared/types/droidor-api'
import HistoryView from '@renderer/views/HistoryView.vue'
import { useDevicesStore } from '@renderer/stores/devices.store'

const SOURCE: KnownDevice = {
  id: 'source-serial',
  nickname: null,
  manufacturer: 'Samsung',
  model: 'Galaxy S24',
  androidVersion: '15',
  sdkVersion: 35,
  connectionState: 'device',
  firstSeenAt: '2026-10-10T10:00:00.000Z',
  lastConnectedAt: '2026-10-10T10:00:00.000Z'
}

const TARGET: KnownDevice = {
  ...SOURCE,
  id: 'target-serial',
  manufacturer: 'Google',
  model: 'Pixel 9'
}

const ENTRY: OperationHistoryEntry = {
  id: 1,
  deviceId: TARGET.id,
  sourceDeviceId: SOURCE.id,
  packageName: 'com.example.app',
  operation: 'split-install',
  previousState: 'not installed',
  newState: 'version code 8',
  success: true,
  rawOutput: 'Copied from Samsung Galaxy S24 (source-serial).',
  performedAt: '2026-10-10T10:00:00.000Z'
}

describe('HistoryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useDevicesStore().$patch({
      devices: [SOURCE, TARGET],
      selectedDeviceId: TARGET.id
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows both devices for a transfer history entry', async () => {
    vi.stubGlobal(
      'window',
      Object.assign(Object.create(window), {
        droidor: {
          getOperationHistory: vi.fn().mockResolvedValue([ENTRY])
        } as unknown as DroidorApi
      })
    )
    const wrapper = mount(HistoryView, {
      global: {
        stubs: {
          DeviceGate: { template: '<div><slot /></div>' }
        }
      }
    })
    await flushPromises()

    const columns = wrapper
      .getComponent(NDataTable)
      .props('columns') as DataTableColumns<OperationHistoryEntry>
    const routeColumn = columns.find((column) => 'key' in column && column.key === 'sourceDeviceId')

    if (!routeColumn || !('render' in routeColumn) || typeof routeColumn.render !== 'function') {
      throw new Error('History view does not render a device route column.')
    }

    expect(routeColumn.render(ENTRY, 0)).toBe('Samsung Galaxy S24 → Google Pixel 9')
  })
})
