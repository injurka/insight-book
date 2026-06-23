import type { LexicalDataGroup, LexicalWordData } from '~/shared/types/models'
import { computed } from 'vue'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'

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

    return {
      nouns: Math.round((nouns / total) * 100),
      verbs: Math.round((verbs / total) * 100),
      adjs: Math.round((adjs / total) * 100),
    }
  })

  return {
    isLegacyLexical,
    legacyTopWords,
    lexData,
    posStats,
  }
}
