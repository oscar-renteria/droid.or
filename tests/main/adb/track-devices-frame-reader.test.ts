import { describe, expect, it } from 'vitest'
import { createTrackDevicesFrameSplitter } from '@main/adb/track-devices-frame-reader'

describe('createTrackDevicesFrameSplitter', () => {
  it('emits nothing until a full frame has arrived', () => {
    const frames: string[] = []
    const feed = createTrackDevicesFrameSplitter((payload) => frames.push(payload))

    feed(Buffer.from('00'))
    expect(frames).toEqual([])
  })

  it('parses a single complete zero-length frame', () => {
    const frames: string[] = []
    const feed = createTrackDevicesFrameSplitter((payload) => frames.push(payload))

    feed(Buffer.from('0000'))
    expect(frames).toEqual([''])
  })

  it('parses a frame with a payload delivered in one chunk', () => {
    const frames: string[] = []
    const feed = createTrackDevicesFrameSplitter((payload) => frames.push(payload))
    const payload = 'ABC123\tdevice\n'
    const length = Buffer.byteLength(payload).toString(16).padStart(4, '0')

    feed(Buffer.from(length + payload))
    expect(frames).toEqual([payload])
  })

  it('reassembles a frame whose length prefix and payload arrive in separate chunks', () => {
    const frames: string[] = []
    const feed = createTrackDevicesFrameSplitter((payload) => frames.push(payload))
    const payload = 'ABC123\tdevice\n'
    const length = Buffer.byteLength(payload).toString(16).padStart(4, '0')

    feed(Buffer.from(length))
    expect(frames).toEqual([])
    feed(Buffer.from(payload.slice(0, 5)))
    expect(frames).toEqual([])
    feed(Buffer.from(payload.slice(5)))
    expect(frames).toEqual([payload])
  })

  it('parses multiple frames delivered in a single chunk', () => {
    const frames: string[] = []
    const feed = createTrackDevicesFrameSplitter((payload) => frames.push(payload))
    const first = 'ABC123\tdevice\n'
    const second = ''
    const firstLength = Buffer.byteLength(first).toString(16).padStart(4, '0')

    feed(Buffer.from(firstLength + first + '0000'))
    expect(frames).toEqual([first, second])
  })
})
