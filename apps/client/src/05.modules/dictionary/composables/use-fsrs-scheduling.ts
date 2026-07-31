import type { Ref } from 'vue'
import type { UserDictItem } from '~/01.shared/types/models'
import { computed } from 'vue'
import { Flashcard } from '~/03.domain/entities/flashcard.entity'

export function useFsrsScheduling(card: Ref<UserDictItem | null>, isFlipped: Ref<boolean>) {
  const intervals = computed(() => {
    if (!isFlipped.value || !card.value)
      return null

    const flashcard = new Flashcard(card.value)
    return flashcard.calculateNextReviewIntervals()
  })

  return { intervals }
}
