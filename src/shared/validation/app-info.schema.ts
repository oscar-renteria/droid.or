import { z } from 'zod'

export const appInfoSchema = z.object({
  appVersion: z.string().min(1),
  electronVersion: z.string().min(1),
  chromeVersion: z.string().min(1),
  nodeVersion: z.string().min(1),
  platform: z.enum(['linux', 'win32', 'darwin']),
  arch: z.string().min(1)
})

export type AppInfo = z.infer<typeof appInfoSchema>
