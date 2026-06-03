import { computed, ref } from 'vue'

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

  function startSession() {
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

  function finishSession() {
    sessionState.value = 'finished'
    endTime.value = Date.now()
  }

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
