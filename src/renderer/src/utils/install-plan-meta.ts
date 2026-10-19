import type { InstallPlanOperation } from '@shared/types/apk-install'

export const PLAN_META: Record<
  InstallPlanOperation,
  { label: string; tagType: 'success' | 'info' | 'default' | 'warning' }
> = {
  'fresh-install': { label: 'New install', tagType: 'success' },
  update: { label: 'Update', tagType: 'info' },
  'reinstall-same-version': { label: 'Reinstall (same version)', tagType: 'default' },
  'downgrade-attempt': { label: 'Downgrade attempt', tagType: 'warning' }
}
