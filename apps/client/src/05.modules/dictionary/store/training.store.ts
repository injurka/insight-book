import type { UserDictItem } from '~/01.shared/types/models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { DIFFICULTY_SYSTEMS } from '~/01.shared/constants/difficulties'
import { Flashcard } from '~/03.domain/entities/flashcard.entity'
import { useDecksStore } from './decks.store'
import { useDictionaryFiltersStore } from './dictionary-filters.store'

export const useTrainingStore = defineStore('training', () => {
  const repos = useRepos()
  const reviewQueue = ref<UserDictItem[]>([])
  const trainingMode = ref<'srs' | 'deep_dive' | 'cram' | 'match'>('srs')

  const newWordsQueueCount = computed(() => reviewQueue.value.filter(w => new Flashcard(w).isNew()).length)
  const learningWordsQueueCount = computed(() => reviewQueue.value.filter(w => new Flashcard(w).isLearning()).length)
  const reviewWordsQueueCount = computed(() => reviewQueue.value.filter(w => new Flashcard(w).isReview()).length)
  const totalReviewCount = computed(() => reviewQueue.value.length)

  async function fetchTrainingQueue(opts: {
    mode: 'srs' | 'deep_dive' | 'cram' | 'match'
    deckId: number | 'none' | 'all'
    difficulty: string[]
  }) {
    trainingMode.value = opts.mode
    try {
      const filtersStore = useDictionaryFiltersStore()
      const decksStore = useDecksStore()
      let langToFetch = filtersStore.selectedLanguage
      if (opts.deckId !== 'all' && opts.deckId !== 'none') {
        const deck = decksStore.decks.find(d => d.id === opts.deckId)
        if (deck)
          langToFetch = deck.language
      }

      let queue = await repos.dictionary.getReviewQueue({
        lang: langToFetch,
        mode: opts.mode,
        deckId: opts.deckId,
        difficulty: 'all',
      })

      if (!opts.difficulty.includes('all') && opts.difficulty.length > 0) {
        queue = queue.filter((w) => {
          return opts.difficulty.some((d) => {
            if (d === 'none')
              return !w.difficulty
            if (d.startsWith('level_')) {
              const targetLevel = Number.parseInt(d.split('_')[1], 10)
              const sys = DIFFICULTY_SYSTEMS[w.language] || DIFFICULTY_SYSTEMS.default
              const diffDef = sys.find(s => s.value === w.difficulty)
              return diffDef && diffDef.level === targetLevel
            }
            return w.difficulty === d
          })
        })
      }

      if (opts.mode === 'srs') {
        for (let i = queue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue[i], queue[j]] = [queue[j], queue[i]]
        }
      }

      reviewQueue.value = queue
    }
    catch (e) {
      console.warn('Could not fetch queue:', e)
      reviewQueue.value = []
      throw e
    }
  }

  return {
    reviewQueue,
    trainingMode,
    newWordsQueueCount,
    learningWordsQueueCount,
    reviewWordsQueueCount,
    totalReviewCount,
    fetchTrainingQueue,
  }
})
