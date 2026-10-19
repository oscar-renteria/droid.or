import type { Component } from 'vue'
import type { RiskLevel } from '@shared/types/analyzer'
import {
  CheckmarkCircleOutline,
  AlertCircleOutline,
  WarningOutline,
  CloseCircleOutline
} from '@vicons/ionicons5'

export interface RiskMeta {
  label: string
  icon: Component
  tone: 'safe' | 'caution' | 'advanced' | 'critical'
}

const RISK_META: Record<RiskLevel, RiskMeta> = {
  safe: { label: 'Safe', icon: CheckmarkCircleOutline, tone: 'safe' },
  caution: { label: 'Caution', icon: AlertCircleOutline, tone: 'caution' },
  advanced: { label: 'Advanced', icon: WarningOutline, tone: 'advanced' },
  critical: { label: 'Critical', icon: CloseCircleOutline, tone: 'critical' }
}

export function getRiskMeta(risk: RiskLevel): RiskMeta {
  return RISK_META[risk]
}

/** Maps a risk tone to a Naive UI NTag `type` for inline use until views
 *  switch to the `RiskBadge` component (Phase 5). caution and advanced share
 *  'warning' here — their distinction is carried by icon + label. */
export function riskNaiveType(tone: RiskMeta['tone']): 'success' | 'warning' | 'error' | 'default' {
  if (tone === 'critical') return 'error'
  if (tone === 'safe') return 'success'
  return 'warning'
}
