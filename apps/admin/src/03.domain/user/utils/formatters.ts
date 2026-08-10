/**
 * Formats token count or limit into human readable format (e.g. 1.5M, 200K, or ∞ if limit is null/undefined/unlimited)
 */
export function formatTokens(n: number | null | undefined): string {
  if (n === null || n === undefined || n < 0)
    return '∞'
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)
    return `${(n / 1_000).toFixed(0)}K`

  return String(n)
}

/**
 * Formats book limit (or ∞ if null/undefined/unlimited)
 */
export function formatLimit(n: number | null | undefined): string {
  if (n === null || n === undefined || n < 0)
    return '∞'

  return String(n)
}
