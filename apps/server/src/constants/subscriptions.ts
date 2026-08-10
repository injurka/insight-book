export interface SubscriptionTierDto {
  id: string
  name: string
  tokenLimit: number
  bookLimit: number
}

export const SUBSCRIPTION_TIERS: SubscriptionTierDto[] = [
  { id: 'free', name: 'Free', tokenLimit: 100_000, bookLimit: 3 },
  { id: 'base', name: 'Base', tokenLimit: 250_000, bookLimit: 5 },
  { id: 'pro', name: 'Pro', tokenLimit: 1_000_000, bookLimit: 20 },
  { id: 'advanced', name: 'Advanced', tokenLimit: 700_000, bookLimit: 15 },
  { id: 'premium', name: 'Premium', tokenLimit: 2_000_000, bookLimit: 30 },
]
