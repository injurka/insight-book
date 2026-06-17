import { describe, expect, it } from 'vitest'

// Helper function replicates the percentage computation logic from:
// - global-actions.vue
// - limits.vue
function computePercent(used: number | undefined | null, limit: number | undefined | null): number {
  const u = used || 0
  const l = limit
  if (l === null || l === undefined || Number.isNaN(l))
    return 0
  if (l === 0)
    return 100
  return Math.min(100, Math.round((u / l) * 100))
}

// Helper function replicates the color class mapping logic from:
// - global-actions.vue
// - limits.vue
function getPercentClass(percentage: number): string {
  if (percentage < 70)
    return 'is-success'
  if (percentage <= 90)
    return 'is-warning'
  return 'is-error'
}

describe('account Limits - Percentage Computation Logic', () => {
  it('handles standard limit usages correctly', () => {
    expect(computePercent(50, 100)).toBe(50)
    expect(computePercent(0, 100)).toBe(0)
    expect(computePercent(100, 100)).toBe(100)
  })

  it('handles infinite limits (null or undefined) by returning 0', () => {
    // Under infinite limit, limit is null/undefined in DB, which defaults to 0 in UI computations.
    expect(computePercent(10, null)).toBe(0)
    expect(computePercent(10, undefined)).toBe(0)
  })

  it('handles zero limit by returning 100 (indicating fully used / blocked limit)', () => {
    expect(computePercent(0, 0)).toBe(100)
    expect(computePercent(10, 0)).toBe(100)
  })

  it('caps the percentage at 100 if usage exceeds limit', () => {
    expect(computePercent(150, 100)).toBe(100)
    expect(computePercent(1000, 10)).toBe(100)
  })

  it('handles negative or NaN values gracefully via standard falsy check', () => {
    // If used or limit are negative, standard logic behaves as follows:
    expect(computePercent(-10, 100)).toBe(-10) // Math.round(-10) -> Math.min(100, -10) -> -10
    // If limit is negative, used is positive:
    expect(computePercent(50, -100)).toBe(-50) // Math.round(-50) -> Math.min(100, -50) -> -50
    // If NaN is passed, it is falsy, so OR defaults it to 0
    expect(computePercent(Number.NaN, 100)).toBe(0)
    expect(computePercent(50, Number.NaN)).toBe(0)
  })
})

describe('account Limits - Color Class Mapping Boundaries', () => {
  it('returns is-success for values under 70%', () => {
    expect(getPercentClass(0)).toBe('is-success')
    expect(getPercentClass(69)).toBe('is-success')
    expect(getPercentClass(69.9)).toBe('is-success')
  })

  it('returns is-warning for values between 70% and 90% (inclusive)', () => {
    expect(getPercentClass(70)).toBe('is-warning')
    expect(getPercentClass(80)).toBe('is-warning')
    expect(getPercentClass(90)).toBe('is-warning')
  })

  it('returns is-error for values over 90%', () => {
    expect(getPercentClass(90.1)).toBe('is-error')
    expect(getPercentClass(91)).toBe('is-error')
    expect(getPercentClass(100)).toBe('is-error')
  })
})
