/**
 * Counts logical CPU cores from /proc/cpuinfo (one "processor" line per
 * core). Read and counted locally rather than via a remote `grep -c`
 * pipeline, since a pipe needs remote shell interpretation for no real
 * benefit here — a plain `cat` is simpler and just as reliable.
 */
export function parseCpuCoreCount(output: string): number | null {
  const count = output.split('\n').filter((line) => line.startsWith('processor')).length
  return count > 0 ? count : null
}
