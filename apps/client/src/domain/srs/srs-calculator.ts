import type { UserDictItem } from '~/shared/types/models'
import { createEmptyCard, FSRS, Rating } from 'ts-fsrs'

export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export interface NextReviewIntervals {
  again: string
  hard: string
  good: string
  easy: string
}

export class SrsCalculator {
  private static fsrs = new FSRS({})

  public static calculateNextReviewIntervals(item: UserDictItem, now: Date = new Date()): NextReviewIntervals {
    const fsrsCard = createEmptyCard()
    fsrsCard.due = item.due ? new Date(item.due) : now
    fsrsCard.stability = item.stability ?? 0
    fsrsCard.difficulty = item.difficultyFsrs ?? 0
    fsrsCard.scheduled_days = item.scheduledDays ?? 0
    fsrsCard.reps = item.reps ?? 0
    fsrsCard.lapses = item.lapses ?? 0
    fsrsCard.state = item.state ?? CardState.New
    fsrsCard.last_review = item.lastReview ? new Date(item.lastReview) : undefined
    fsrsCard.learning_steps = item.learningSteps ?? 0

    const schedulingCards = this.fsrs.repeat(fsrsCard, now)

    return {
      again: this.formatInterval(schedulingCards[Rating.Again].card.scheduled_days, schedulingCards[Rating.Again].card.due, now),
      hard: this.formatInterval(schedulingCards[Rating.Hard].card.scheduled_days, schedulingCards[Rating.Hard].card.due, now),
      good: this.formatInterval(schedulingCards[Rating.Good].card.scheduled_days, schedulingCards[Rating.Good].card.due, now),
      easy: this.formatInterval(schedulingCards[Rating.Easy].card.scheduled_days, schedulingCards[Rating.Easy].card.due, now),
    }
  }

  private static formatInterval(days: number, due: Date, now: Date): string {
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
}
