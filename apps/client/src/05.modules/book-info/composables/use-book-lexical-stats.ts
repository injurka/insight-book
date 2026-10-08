import type { LexicalDataGroup, LexicalWordData } from '~/01.shared/types/models'
import { computed } from 'vue'
import { useLibraryStore } from '~/05.modules/library/store/library.store'

function roundShares(counts: number[], total: number) {
  const shares = counts.map(count => count / total * 100)
  const percentages = shares.map(Math.floor)
  const order = shares.map((share, index) => ({ index, remainder: share - percentages[index] }))
    .sort((a, b) => b.remainder - a.remainder)
  const remaining = 100 - percentages.reduce((sum, value) => sum + value, 0)
  for (let i = 0; i < remaining; i++) percentages[order[i].index]++

  return percentages
}

export function useBookLexicalStats() {
  const libraryStore = useLibraryStore()

  const isLegacyLexical = computed(() => {
    return Array.isArray(libraryStore.currentBookInfo?.stats?.topWords)
  })

  const legacyTopWords = computed(() => {
    if (isLegacyLexical.value)
      return libraryStore.currentBookInfo?.stats?.topWords as LexicalWordData[]

    return []
  })

  const lexData = computed(() => {
    if (isLegacyLexical.value)
      return null

    return libraryStore.currentBookInfo?.stats?.topWords as LexicalDataGroup
  })

  const posStats = computed(() => {
    const dist = libraryStore.currentBookInfo?.stats?.posDistribution
    if (!dist)
      return null

    let nouns = 0
    let verbs = 0
    let adjs = 0
    let others = 0

    for (const [tag, count] of Object.entries(dist)) {
      if (tag.startsWith('n'))
        nouns += count
      else if (tag.startsWith('v'))
        verbs += count
      else if (tag.startsWith('a') || tag.startsWith('d'))
        adjs += count
      else others += count
    }

    const total = nouns + verbs + adjs + others

    if (total === 0)
      return null

    const percentages = roundShares([nouns, verbs, adjs, others], total)

    return {
      nouns: percentages[0],
      verbs: percentages[1],
      adjs: percentages[2],
      others: percentages[3],
    }
  })

  return {
    isLegacyLexical,
    legacyTopWords,
    lexData,
    posStats,
  }
}
