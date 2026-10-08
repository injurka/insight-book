import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { useBookLexicalStats } from './use-book-lexical-stats'

const { useLibraryStore } = vi.hoisted(() => ({ useLibraryStore: vi.fn() }))
vi.mock('~/05.modules/library/store/library.store', () => ({ useLibraryStore }))

describe('lexical POS distribution', () => {
  it('rounds to exactly 100 without negative shares', () => {
    useLibraryStore.mockReturnValue(reactive({ currentBookInfo: { stats: { posDistribution: { n: 335, v: 335, a: 330 } } } }))
    const { posStats } = useBookLexicalStats()
    const stats = posStats.value!
    expect(Object.values(stats).reduce((sum, count) => sum + count, 0)).toBe(100)
    expect(stats.others).toBe(0)
  })
  it('includes function words and recognizes detailed Chinese tags', () => {
    useLibraryStore.mockReturnValue(reactive({ currentBookInfo: { stats: { posDistribution: { nr: 2, vn: 2, ad: 2, r: 4 } } } }))
    expect(useBookLexicalStats().posStats.value).toEqual({ nouns: 20, verbs: 20, adjs: 20, others: 40 })
  })
  it('does not display a breakdown for empty data', () => {
    useLibraryStore.mockReturnValue({ currentBookInfo: { stats: { posDistribution: {} } } })
    expect(useBookLexicalStats().posStats.value).toBeNull()
  })
})
