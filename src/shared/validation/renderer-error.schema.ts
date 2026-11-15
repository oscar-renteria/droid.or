import { z } from 'zod'

/** Bounded so a runaway error loop can't push megabytes over IPC. */
export const rendererErrorReportSchema = z.object({
  source: z.enum(['vue', 'window-error', 'unhandled-rejection']),
  message: z.string().max(2_000),
  stack: z.string().max(10_000).nullable(),
  /** Vue's lifecycle hint ("render function", "setup function", …). */
  info: z.string().max(200).nullable()
})
export type RendererErrorReport = z.infer<typeof rendererErrorReportSchema>
