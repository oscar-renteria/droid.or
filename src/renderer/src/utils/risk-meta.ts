import type { RiskLevel } from '@shared/types/analyzer'

export interface RiskMeta {
  label: string
  emoji: string
  tagType: 'success' | 'warning' | 'error' | 'default'
}

const RISK_META: Record<RiskLevel, RiskMeta> = {
  safe: { label: 'Safe', emoji: '🟢', tagType: 'success' },
  caution: { label: 'Caution', emoji: '🟡', tagType: 'warning' },
  advanced: { label: 'Advanced', emoji: '🟠', tagType: 'warning' },
  critical: { label: 'Critical', emoji: '🔴', tagType: 'error' }
}

export function getRiskMeta(risk: RiskLevel): RiskMeta {
  return RISK_META[risk]
}
