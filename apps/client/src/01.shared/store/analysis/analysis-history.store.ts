import type { LlmAnalysis } from '~/01.shared/types/models'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface AnalysisHistoryItem {
  sentence: string
  analysis: LlmAnalysis
  timestamp: number
}

export const useAnalysisHistoryStore = defineStore('analysisHistory', () => {
  const analysisHistory = ref<AnalysisHistoryItem[]>([])

  function addHistoryItem(sentence: string, analysis: LlmAnalysis) {
    analysisHistory.value.unshift({
      sentence,
      analysis,
      timestamp: Date.now(),
    })
    if (analysisHistory.value.length > 50)
      analysisHistory.value.pop()
  }

  function clearHistory() {
    analysisHistory.value = []
  }

  return {
    analysisHistory,
    addHistoryItem,
    clearHistory,
  }
})
