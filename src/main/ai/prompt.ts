import type { PackageAiAnalysisInput } from './ai-provider'

/**
 * Deliberately asks for a short, hedged opinion rather than a structured
 * verdict — the result is shown to the user as free text labeled "AI
 * opinion", never parsed back into the app's own risk classification, so
 * there's no need (and no reliable way) to force the model into a rigid
 * output format here.
 */
export function buildAnalysisPrompt(input: PackageAiAnalysisInput): string {
  return [
    'You are helping a user decide whether an Android app package is safe to disable or uninstall on their own, non-rooted device.',
    'Give a short, practical opinion in 3-6 sentences: what the package likely is or does, how risky removing it looks, and what could break if it is disabled or uninstalled for the current user.',
    "If you don't recognize this specific package, say so plainly rather than guessing confidently.",
    '',
    `Device: ${input.manufacturer ?? 'unknown manufacturer'} ${input.model ?? ''}, Android ${input.androidVersion ?? 'unknown version'}`,
    `Package: ${input.packageName}`,
    `App label: ${input.appLabel ?? 'unknown'}`,
    `Version: ${input.versionName ?? 'unknown'}`,
    `Type: ${input.isSystemApp ? 'system/preinstalled app' : 'user-installed app'}`,
    `Requested permissions: ${input.permissions.length > 0 ? input.permissions.join(', ') : 'none reported'}`
  ].join('\n')
}
