import { computed, ref } from 'vue'
import { useUmami } from '~/shared/composables/use-umami'

export function useSrsSession() {
  const sessionState = ref<'setup' | 'active' | 'finished'>('setup')
  const currentIndex = ref(0)
  const startTime = ref(0)
  const endTime = ref(0)

  const stats = ref({
    newStudied: 0,
    reviewed: 0,
    correctAnswers: 0,
    totalAnswers: 0,
  })

  const timeSpentMs = computed(() => {
    if (startTime.value === 0)
      return 0
    return (endTime.value || Date.now()) - startTime.value
  })

  const accuracy = computed(() => {
    if (stats.value.totalAnswers === 0)
      return 0
    return Math.round((stats.value.correctAnswers / stats.value.totalAnswers) * 100)
  })

  function recordAnswer(isNew: boolean, grade: number) {
    if (isNew)
      stats.value.newStudied++
    else stats.value.reviewed++

    stats.value.totalAnswers++
    if (grade >= 2) { // 2 = Good, 3 = Easy
      stats.value.correctAnswers++
    }
  }

  function finishSession() {
    const { trackEvent } = useUmami()

    sessionState.value = 'finished'
    endTime.value = Date.now()

    trackEvent('srs_training_finished', {
      accuracy: accuracy.value,
      totalAnswers: stats.value.totalAnswers,
      timeSpentSeconds: Math.round(timeSpentMs.value / 1000),
    })
  }

  function startSession() {
    const { trackEvent } = useUmami()
    trackEvent('srs_training_started')

    sessionState.value = 'active'
    currentIndex.value = 0
    startTime.value = Date.now()
    stats.value = {
      newStudied: 0,
      reviewed: 0,
      correctAnswers: 0,
      totalAnswers: 0,
    }
  }

  function reset() {
    sessionState.value = 'setup'
    currentIndex.value = 0
    startTime.value = 0
    endTime.value = 0
  }

  return {
    sessionState,
    currentIndex,
    stats,
    timeSpentMs,
    accuracy,
    startSession,
    finishSession,
    recordAnswer,
    reset,
  }
}
