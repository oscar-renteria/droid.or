/**
 * `adb track-devices` does not stream plain text like `adb devices` does.
 * Verified directly against the installed adb binary (platform-tools 34.0.4):
 * each update is a 4-byte ASCII-hex length prefix followed by exactly that
 * many bytes of payload (the same device-list body format `adb devices -l`
 * prints, minus its header line), repeated for the life of the connection.
 * stdout data events don't respect frame boundaries, so this buffers across
 * chunks and can emit zero, one, or several frames per call to `feed`.
 */
export function createTrackDevicesFrameSplitter(
  onFrame: (payload: string) => void
): (chunk: Buffer) => void {
  let buffer = Buffer.alloc(0)

  return function feed(chunk: Buffer): void {
    buffer = Buffer.concat([buffer, chunk])

    for (;;) {
      if (buffer.length < 4) {
        return
      }
      const length = Number.parseInt(buffer.subarray(0, 4).toString('ascii'), 16)
      if (!Number.isInteger(length) || length < 0) {
        // Protocol desync (shouldn't happen against a real adb server) —
        // drop what we have rather than spin on data we can't interpret.
        buffer = Buffer.alloc(0)
        return
      }
      if (buffer.length < 4 + length) {
        return
      }
      onFrame(buffer.subarray(4, 4 + length).toString('utf8'))
      buffer = buffer.subarray(4 + length)
    }
  }
}
