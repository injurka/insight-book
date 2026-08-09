import type { UserDictItem } from '~/01.shared/types/models'

import { computed, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import { DIFFICULTY_SYSTEMS } from '~/01.shared/constants/difficulties'
import { Flashcard } from '~/03.domain/entities/flashcard.entity'

// Импортируем decks-store из модуля dictionary — однонаправленная зависимость допустима
// (srs-training -> dictionary DAL, но не наоборот).
// Доступ к decks нужен только для resolving language по deckId.
import { useDecksStore } from '~/05.modules/dictionary/store/decks.store'
import { useDictionaryFiltersStore } from '~/05.modules/dictionary/store/dictionary-filters.store'

export const useTrainingStore = defineStore('training', () => {
  const repos = useRepos()
  const reviewQueue = ref<UserDictItem[]>([])
  const trainingMode = ref<'srs' | 'deep_dive' | 'cram' | 'match'>('srs')

  const newWordsQueueCount = computed(() => reviewQueue.value.filter(w => new Flashcard(w).isNew()).length)
  const learningWordsQueueCount = computed(() => reviewQueue.value.filter(w => new Flashcard(w).isLearning()).length)
  const reviewWordsQueueCount = computed(() => reviewQueue.value.filter(w => new Flashcard(w).isReview()).length)
  const totalReviewCount = computed(() => reviewQueue.value.length)

  function resolveLangToFetch(deckIdParam: (number | 'none' | 'all')[] | number | 'none' | 'all') {
    const filtersStore = useDictionaryFiltersStore()
    const decksStore = useDecksStore()
    const deckIdsArray = Array.isArray(deckIdParam) ? deckIdParam : [deckIdParam]
    if (!deckIdsArray.includes('all') && !deckIdsArray.includes('none') && deckIdsArray.length > 0) {
      const firstDeckId = deckIdsArray.find((id): id is number => typeof id === 'number')
      if (firstDeckId !== undefined) {
        const deck = decksStore.decks.find(d => d.id === firstDeckId)
        if (deck)
          return deck.language
      }
    }

    return filtersStore.selectedLanguage
  }

  function filterQueueByDifficulty(queue: UserDictItem[], difficulty: string[]): UserDictItem[] {
    if (difficulty.includes('all') || difficulty.length === 0)
      return queue

    return queue.filter(w => difficulty.some((d) => {
      if (d === 'none')
        return !w.difficulty
      if (d.startsWith('level_')) {
        const targetLevel = Number.parseInt(d.split('_')[1], 10)
        const sys = DIFFICULTY_SYSTEMS[w.language] || DIFFICULTY_SYSTEMS.default
        const diffDef = sys.find(s => s.value === w.difficulty)

        return Boolean(diffDef && diffDef.level === targetLevel)
      }

      return w.difficulty === d
    }))
  }

  function shuffleArray<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
  }

  async function fetchTrainingQueue(opts: {
    mode: 'srs' | 'deep_dive' | 'cram' | 'match'
    deckId: (number | 'none' | 'all')[] | number | 'none' | 'all'
    difficulty: string[]
  }) {
    trainingMode.value = opts.mode
    try {
      const langToFetch = resolveLangToFetch(opts.deckId)
      const rawQueue = await repos.dictionary.getReviewQueue({
        lang: langToFetch,
        mode: opts.mode,
        deckId: opts.deckId,
        difficulty: 'all',
      })

      const queue = filterQueueByDifficulty(rawQueue, opts.difficulty)

      if (opts.mode === 'srs') {
        shuffleArray(queue)
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
