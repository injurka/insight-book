import type { UsageLevel } from '~/03.domain/user'

export interface UserMetricTile {
  key: string
  icon: string
  label: string
  value: string
  hint?: string
  progress?: {
    percent: number
    level: UsageLevel
  }
}
