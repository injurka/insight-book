import type { SubscriptionTier } from '~/01.shared/types/models'

export const DEFAULT_SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  { id: 'free', name: 'Free', tokenLimit: 100_000, bookLimit: 3 },
  { id: 'base', name: 'Base', tokenLimit: 250_000, bookLimit: 5 },
  { id: 'pro', name: 'Pro', tokenLimit: 1_000_000, bookLimit: 20 },
  { id: 'advanced', name: 'Advanced', tokenLimit: 700_000, bookLimit: 15 },
  { id: 'premium', name: 'Premium', tokenLimit: 2_000_000, bookLimit: 30 },
]

export function formatTierOptions(tiers: SubscriptionTier[] = DEFAULT_SUBSCRIPTION_TIERS) {
  return tiers.map(t => ({
    value: t.id,
    label: t.name,
  }))
}

export function getTierDefaults(
  tierKey: string,
  tiers: SubscriptionTier[] = DEFAULT_SUBSCRIPTION_TIERS,
): { tokenLimit: number, bookLimit: number } {
  const tier = tiers.find(t => t.id === tierKey)
  if (tier) {
    return { tokenLimit: tier.tokenLimit, bookLimit: tier.bookLimit }
  }

  return { tokenLimit: 100_000, bookLimit: 3 }
}
