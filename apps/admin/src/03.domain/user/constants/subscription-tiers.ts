import type { SubscriptionTier } from '~/01.shared/types/models'

/** Фоллбек на случай недоступности API (легаси-тариф pro сохранён для обратной совместимости). */
export const DEFAULT_SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  makeTier('free', 'Starter (Free)', 'Стартовый (Free)', 100_000, 1),
  makeTier('base', 'Basic Subscription', 'Базовая подписка', 250_000, 2),
  makeTier('pro', 'Pro', 'Pro', 1_000_000, 20),
  makeTier('advanced', 'Advanced Subscription', 'Продвинутая подписка', 700_000, 4),
  makeTier('premium', 'Premium Subscription', 'Премиум подписка', 2_000_000, 10),
]

function makeTier(
  id: string,
  nameEn: string,
  nameRu: string,
  dailyTokenLimit: number,
  dailyBookLimit: number,
): SubscriptionTier {
  return {
    id,
    sortOrder: 0,
    icon: 'mdi:star',
    price: 0,
    dailyTokenLimit,
    dailyBookLimit,
    isPopular: false,
    gradient: '',
    accentColor: '#94a3b8',
    badgeEn: nameEn,
    badgeRu: nameRu,
    badgeZh: nameEn,
    nameEn,
    nameRu,
    nameZh: nameEn,
    descriptionEn: '',
    descriptionRu: '',
    descriptionZh: '',
    featuresEn: [],
    featuresRu: [],
    featuresZh: [],
  }
}

export function formatTierOptions(tiers: SubscriptionTier[] = DEFAULT_SUBSCRIPTION_TIERS) {
  return tiers.map(t => ({
    value: t.id,
    label: t.nameRu || t.nameEn || t.id,
  }))
}

export function getTierDefaults(
  tierKey: string,
  tiers: SubscriptionTier[] = DEFAULT_SUBSCRIPTION_TIERS,
): { tokenLimit: number, bookLimit: number } {
  const tier = tiers.find(t => t.id === tierKey)
  if (tier) {
    return { tokenLimit: tier.dailyTokenLimit ?? 100_000, bookLimit: tier.dailyBookLimit ?? 3 }
  }

  return { tokenLimit: 100_000, bookLimit: 3 }
}
