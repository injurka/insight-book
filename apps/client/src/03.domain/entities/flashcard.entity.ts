import type { UserDictItem, WordEncounter } from '~/01.shared/types/models'
import { createEmptyCard, FSRS, Rating } from 'ts-fsrs'

export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export class Flashcard implements UserDictItem {
  id!: number
  deckIds!: number[]
  word!: string
  transcription!: string | null
  translation!: string | null
  language!: string
  targetLanguage!: string
  notes!: string | null
  tags!: string | null
  difficulty!: string | null
  grammarNote!: string | null
  vocabularyNote!: string | null

  // FSRS Fields
  state!: number
  due!: string
  stability!: number
  difficultyFsrs!: number
  scheduledDays!: number
  reps!: number
  lapses!: number
  lastReview!: string | null
  learningSteps!: number

  createdAt!: string
  updatedAt!: string

  encounters?: WordEncounter[]

  private static fsrs = new FSRS({})

  constructor(data: UserDictItem) {
    Object.assign(this, data)
  }

  isNew(): boolean {
    return this.state === CardState.New
  }

  isLearning(): boolean {
    return this.state === CardState.Learning || this.state === CardState.Relearning
  }

  isReview(): boolean {
    return this.state === CardState.Review
  }

  /**
   * Calculates intervals for different FSRS ratings.
   */
  calculateNextReviewIntervals(now: Date = new Date()) {
    const parseSafeDate = (d?: string | number | Date | null): Date | undefined => {
      if (!d)
        return undefined
      const parsed = new Date(d)

      return Number.isNaN(parsed.getTime()) ? undefined : parsed
    }

    const fsrsCard = createEmptyCard()
    fsrsCard.due = parseSafeDate(this.due) ?? new Date(now)
    fsrsCard.stability = this.stability
    fsrsCard.difficulty = this.difficultyFsrs
    fsrsCard.scheduled_days = this.scheduledDays
    fsrsCard.reps = this.reps
    fsrsCard.lapses = this.lapses
    fsrsCard.state = this.state
    fsrsCard.last_review = parseSafeDate(this.lastReview)
    fsrsCard.learning_steps = this.learningSteps ?? 0

    const schedulingCards = Flashcard.fsrs.repeat(fsrsCard, now)

    return {
      again: this.formatInterval(schedulingCards[Rating.Again].card.scheduled_days, schedulingCards[Rating.Again].card.due, now),
      hard: this.formatInterval(schedulingCards[Rating.Hard].card.scheduled_days, schedulingCards[Rating.Hard].card.due, now),
      good: this.formatInterval(schedulingCards[Rating.Good].card.scheduled_days, schedulingCards[Rating.Good].card.due, now),
      easy: this.formatInterval(schedulingCards[Rating.Easy].card.scheduled_days, schedulingCards[Rating.Easy].card.due, now),
    }
  }

  private formatInterval(days: number, due: Date, now: Date): string {
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
