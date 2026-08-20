import { ref, computed, type Ref } from 'vue'
import type { GrammarMasteryLevel, GrammarSrsItem, Rule } from '~plugin-grammar-rules/shared/types'

const SRS_STORAGE_KEY = 'plugin_grammar_rules_srs_v1'

const INTERVALS_DAYS: Record<GrammarMasteryLevel, number> = {
  new: 0,
  learning: 1,
  review: 4,
  mastered: 21
}

export function useGrammarSrs(rules: Ref<Rule[]>, lang: Ref<string>) {
  const srsMap = ref<Record<string, GrammarSrsItem>>({})

  const loadFromStorage = () => {
    try {
      const raw = localStorage.getItem(SRS_STORAGE_KEY)
      if (raw) {
        srsMap.value = JSON.parse(raw)
      }
    } catch {
      srsMap.value = {}
    }
  }

  const saveToStorage = () => {
    try {
      localStorage.setItem(SRS_STORAGE_KEY, JSON.stringify(srsMap.value))
    } catch (e) {
      console.warn('Failed to save SRS state', e)
    }
  }

  loadFromStorage()

  const getRuleSrs = (ruleId: string): GrammarSrsItem => {
    const key = `${lang.value}:${ruleId}`
    if (!srsMap.value[key]) {
      srsMap.value[key] = {
        ruleId,
        lang: lang.value,
        mastery: 'new',
        streak: 0,
        totalAttempts: 0,
        correctAttempts: 0,
        lastReviewedAt: null,
        nextReviewAt: null
      }
    }
    return srsMap.value[key]
  }

  const recordRuleResult = (ruleId: string, isCorrect: boolean) => {
    const key = `${lang.value}:${ruleId}`
    const item = getRuleSrs(ruleId)

    item.totalAttempts++
    item.lastReviewedAt = new Date().toISOString()

    if (isCorrect) {
      item.correctAttempts++
      item.streak++

      if (item.streak >= 4) {
        item.mastery = 'mastered'
      } else if (item.streak >= 2) {
        item.mastery = 'review'
      } else {
        item.mastery = 'learning'
      }
    } else {
      item.streak = 0
      item.mastery = 'learning'
    }

    const intervalDays = INTERVALS_DAYS[item.mastery]
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + intervalDays)
    item.nextReviewAt = nextDate.toISOString()

    srsMap.value = { ...srsMap.value, [key]: item }
    saveToStorage()
  }

  const rulesDueForReview = computed(() => {
    const now = new Date().getTime()
    return rules.value.filter((r) => {
      const item = getRuleSrs(r.id)
      if (item.mastery === 'new') return true
      if (!item.nextReviewAt) return true
      return new Date(item.nextReviewAt).getTime() <= now
    })
  })

  const stats = computed(() => {
    const currentRules = rules.value
    let newCount = 0
    let learningCount = 0
    let reviewCount = 0
    let masteredCount = 0

    for (const r of currentRules) {
      const item = getRuleSrs(r.id)
      switch (item.mastery) {
        case 'new': newCount++; break
        case 'learning': learningCount++; break
        case 'review': reviewCount++; break
        case 'mastered': masteredCount++; break
      }
    }

    const total = currentRules.length || 1
    const progressPercent = Math.round((masteredCount / total) * 100)

    return {
      total: currentRules.length,
      newCount,
      learningCount,
      reviewCount,
      masteredCount,
      progressPercent
    }
  })

  return {
    getRuleSrs,
    recordRuleResult,
    rulesDueForReview,
    stats
  }
}
