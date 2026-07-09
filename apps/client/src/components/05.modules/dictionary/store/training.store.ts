import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { api } from '~/shared/services/api.service'
import { useDecksStore } from './decks.store'
import { useDictionaryFiltersStore } from './dictionary-filters.store'

export const useTrainingStore = defineStore('training', () => {
  const reviewQueue = ref<any[]>([])
  const trainingMode = ref<'srs' | 'deep_dive' | 'cram' | 'match'>('srs')

  const newWordsQueueCount = computed(() => reviewQueue.value.filter(w => w.state === 0).length)
  const reviewWordsQueueCount = computed(() => reviewQueue.value.filter(w => w.state > 0).length)
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

      let queue = await api.dictionary.getReviewQueue({
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
    reviewWordsQueueCount,
    totalReviewCount,
    fetchTrainingQueue,
  }
})
