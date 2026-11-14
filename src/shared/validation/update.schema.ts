import { z } from 'zod'

export const updateStatusSchema = z.object({
  /** Version of the running app (package.json). */
  currentVersion: z.string(),
  /** Newest published (non-prerelease) version, or null if never checked
   *  successfully. */
  latestVersion: z.string().nullable(),
  updateAvailable: z.boolean(),
  /** Release page for `latestVersion` — always on this project's GitHub
   *  releases, built from a validated tag, never taken from the response. */
  releaseUrl: z.string().url().nullable(),
  /** Epoch ms of the last successful check, or null. */
  checkedAt: z.number().int().nullable()
})
export type UpdateStatus = z.infer<typeof updateStatusSchema>
