import type { AnalysisHistoryItem, ChineseSentenceAnalysis } from '../model'
import { ref } from 'vue'

const STORAGE_KEY = 'insight-book:plugin-chinese-analyzer:history-v1'
const MAX_HISTORY_ITEMS = 25

function readStoredHistory(): AnalysisHistoryItem[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown

    return Array.isArray(parsed) ? parsed as AnalysisHistoryItem[] : []
  }
  catch {
    return []
  }
}

function writeStoredHistory(items: AnalysisHistoryItem[]): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }
  catch {
    // Ignore storage quota errors
  }
}

export function useAnalyzerHistory() {
  const historyItems = ref<AnalysisHistoryItem[]>(readStoredHistory())

  function saveToHistory(query: string, analysis: ChineseSentenceAnalysis): void {
    const cleanHanzi = analysis.sentence.hanzi.trim()
    const filtered = historyItems.value.filter(item => item.hanzi !== cleanHanzi && item.query !== query.trim())

    const newItem: AnalysisHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      query: query.trim(),
      hanzi: cleanHanzi,
      pinyin: analysis.sentence.pinyin,
      translation: analysis.sentence.translation,
      hskLevel: analysis.sentence.hskLevel,
      analysis,
    }

    historyItems.value = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS)
    writeStoredHistory(historyItems.value)
  }

  function removeHistoryItem(id: string): void {
    historyItems.value = historyItems.value.filter(item => item.id !== id)
    writeStoredHistory(historyItems.value)
  }

  function clearHistory(): void {
    historyItems.value = []
    writeStoredHistory([])
  }

  return {
    historyItems,
    saveToHistory,
    removeHistoryItem,
    clearHistory,
  }
}
