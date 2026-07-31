export type SubscriptionTierId = 'free' | 'base' | 'advanced' | 'premium'

export interface SubscriptionTierConfig {
  id: SubscriptionTierId
  icon: string
  badge: string
  nameKey: string
  priceRu: number
  pricePeriodKey: string
  descriptionKey: string
  dailyTokens: number
  dailyBooks: number
  popular?: boolean
  gradient: string
  accentColor: string
  featuresKeys: string[]
}

export const SUBSCRIPTION_TIERS_CONFIG: Record<SubscriptionTierId, SubscriptionTierConfig> = {
  free: {
    id: 'free',
    icon: 'mdi:leaf',
    badge: '🌱 Free',
    nameKey: 'subscriptions.tiers.free.name',
    priceRu: 0,
    pricePeriodKey: 'subscriptions.freeForever',
    descriptionKey: 'subscriptions.tiers.free.description',
    dailyTokens: 100_000,
    dailyBooks: 1,
    gradient: 'linear-gradient(135deg, rgba(148, 163, 184, 0.12), rgba(71, 85, 105, 0.04))',
    accentColor: '#94a3b8',
    featuresKeys: [
      'subscriptions.tiers.free.f1',
      'subscriptions.tiers.free.f2',
      'subscriptions.tiers.free.f3',
      'subscriptions.tiers.free.f4',
    ],
  },
  base: {
    id: 'base',
    icon: 'mdi:medal',
    badge: '🥉 Базовый',
    nameKey: 'subscriptions.tiers.base.name',
    priceRu: 150,
    pricePeriodKey: 'subscriptions.perMonth',
    descriptionKey: 'subscriptions.tiers.base.description',
    dailyTokens: 250_000,
    dailyBooks: 2,
    gradient: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15), rgba(180, 83, 9, 0.05))',
    accentColor: '#d97706',
    featuresKeys: [
      'subscriptions.tiers.base.f1',
      'subscriptions.tiers.base.f2',
      'subscriptions.tiers.base.f3',
      'subscriptions.tiers.base.f4',
      'subscriptions.tiers.base.f5',
    ],
  },
  advanced: {
    id: 'advanced',
    icon: 'mdi:star-four-points',
    badge: '🥈 Продвинутый',
    nameKey: 'subscriptions.tiers.advanced.name',
    priceRu: 350,
    pricePeriodKey: 'subscriptions.perMonth',
    descriptionKey: 'subscriptions.tiers.advanced.description',
    dailyTokens: 700_000,
    dailyBooks: 4,
    popular: true,
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.1))',
    accentColor: '#3b82f6',
    featuresKeys: [
      'subscriptions.tiers.advanced.f1',
      'subscriptions.tiers.advanced.f2',
      'subscriptions.tiers.advanced.f3',
      'subscriptions.tiers.advanced.f4',
      'subscriptions.tiers.advanced.f5',
      'subscriptions.tiers.advanced.f6',
    ],
  },
  premium: {
    id: 'premium',
    icon: 'mdi:crown',
    badge: '🥇 Премиум',
    nameKey: 'subscriptions.tiers.premium.name',
    priceRu: 950,
    pricePeriodKey: 'subscriptions.perMonth',
    descriptionKey: 'subscriptions.tiers.premium.description',
    dailyTokens: 2_000_000,
    dailyBooks: 10,
    gradient: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(245, 158, 11, 0.1))',
    accentColor: '#eab308',
    featuresKeys: [
      'subscriptions.tiers.premium.f1',
      'subscriptions.tiers.premium.f2',
      'subscriptions.tiers.premium.f3',
      'subscriptions.tiers.premium.f4',
      'subscriptions.tiers.premium.f5',
    ],
  },
}
