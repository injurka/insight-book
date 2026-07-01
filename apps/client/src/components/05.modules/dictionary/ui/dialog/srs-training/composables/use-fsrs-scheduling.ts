import type { Ref } from 'vue'
import type { UserDictItem } from '~/shared/types/models'
import { createEmptyCard, FSRS, Rating } from 'ts-fsrs'
import { computed } from 'vue'

function formatInterval(days: number, due: Date, now: Date): string {
  if (days === 0) {
    const diffMin = Math.round((due.getTime() - now.getTime()) / 60000)
    return diffMin > 0 ? `${diffMin} м` : '<1 м'
  }
  if (days < 30)
    return `${Math.round(days)} дн`
  if (days < 365)
    return `${Math.round(days / 30)} мес`
  return `${Math.round(days / 365)} г`
}

export function useFsrsScheduling(card: Ref<UserDictItem | null>, isFlipped: Ref<boolean>) {
  const fsrs = new FSRS({})

  const intervals = computed(() => {
    if (!isFlipped.value || !card.value)
      return null

    const fsrsCard = createEmptyCard()
    fsrsCard.due = new Date(card.value.due)
    fsrsCard.stability = card.value.stability
    fsrsCard.difficulty = card.value.difficultyFsrs
    fsrsCard.scheduled_days = card.value.scheduledDays
    fsrsCard.reps = card.value.reps
    fsrsCard.lapses = card.value.lapses
    fsrsCard.state = card.value.state
    fsrsCard.last_review = card.value.lastReview ? new Date(card.value.lastReview) : undefined
    fsrsCard.learning_steps = card.value.learningSteps ?? 0

    const now = new Date()
    const schedulingCards = fsrs.repeat(fsrsCard, now)

    return {
      again: formatInterval(schedulingCards[Rating.Again].card.scheduled_days, schedulingCards[Rating.Again].card.due, now),
      hard: formatInterval(schedulingCards[Rating.Hard].card.scheduled_days, schedulingCards[Rating.Hard].card.due, now),
      good: formatInterval(schedulingCards[Rating.Good].card.scheduled_days, schedulingCards[Rating.Good].card.due, now),
      easy: formatInterval(schedulingCards[Rating.Easy].card.scheduled_days, schedulingCards[Rating.Easy].card.due, now),
    }
  })

  return { intervals }
}
