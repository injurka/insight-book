import type {
  CanvasSelectedNode,
  CanvasViewMode,
  RussianLexemeToken,
  RussianSentenceAnalysis,
} from '../model'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { requestLlmGenerate } from '../../../shared/lib/api'
import {
  buildRussianAnalyzerSystemPrompt,
  buildRussianAnalyzerUserPrompt,
  normalizeRussianAnalysisResponse,
} from '../../../shared/lib/russian-prompt'
import { detectRussianAnalyzerInputLanguage, stripStressMarks } from '../../../shared/lib/russian-utils'
import { getSentenceTabs, sliceAnalysisBySentence } from '../../../shared/lib/sentence-view'
import { useAnalyzerHistory } from './use-analyzer-history'

function getInitialSelectedNode(analysis: RussianSentenceAnalysis): CanvasSelectedNode | null {
  const multiMorphToken = analysis.tokens.find(t => t.morphemes.length >= 2)
  const target = multiMorphToken || analysis.tokens[0]

  return target ? { kind: 'token', token: target } : null
}

function getAllTokenIds(tokens: RussianLexemeToken[]): string[] {
  return tokens.map(t => t.id)
}

export function useRussianAnalyzer() {
  const { locale, t } = useI18n()
  const history = useAnalyzerHistory()

  const queryInput = ref('')
  const isAnalyzing = ref(false)
  const errorMessage = ref<string | null>(null)
  const currentAnalysis = ref<RussianSentenceAnalysis | null>(null)
  const selectedNode = ref<CanvasSelectedNode | null>(null)
  const expandedTokenIds = ref<string[]>([])
  const showStressMarks = ref(true)
  const canvasViewMode = ref<CanvasViewMode>('hierarchy')
  /** Ключ выбранного предложения; `null` — показывать разбор целиком. */
  const activeSentenceIndex = ref<number | null>(null)

  const detectedLanguage = computed(() => detectRussianAnalyzerInputLanguage(queryInput.value))
  const sentenceTabs = computed(() => currentAnalysis.value ? getSentenceTabs(currentAnalysis.value) : [])
  /** Разбор, который отображается на странице: целиком или срез по активному предложению. */
  const viewAnalysis = computed<RussianSentenceAnalysis | null>(() => {
    const analysis = currentAnalysis.value
    const index = activeSentenceIndex.value

    return analysis && index !== null ? sliceAnalysisBySentence(analysis, index) : analysis
  })
  const viewTokenIds = computed(() => getAllTokenIds(viewAnalysis.value?.tokens ?? []))
  const areAllTokensExpanded = computed(() => {
    const ids = viewTokenIds.value

    return ids.length > 0 && ids.every(id => expandedTokenIds.value.includes(id))
  })

  function applyAnalysisResult(analysis: RussianSentenceAnalysis): void {
    activeSentenceIndex.value = null
    currentAnalysis.value = analysis
    expandedTokenIds.value = getAllTokenIds(analysis.tokens)
    selectedNode.value = getInitialSelectedNode(analysis)
  }

  function focusSentence(index: number | null): void {
    if (index !== null && !sentenceTabs.value.some(tab => tab.index === index)) {
      return
    }

    activeSentenceIndex.value = index
    selectedNode.value = viewAnalysis.value ? getInitialSelectedNode(viewAnalysis.value) : null
  }

  function selectNode(node: CanvasSelectedNode): void {
    selectedNode.value = node
  }

  function toggleTokenExpand(tokenId: string): void {
    if (expandedTokenIds.value.includes(tokenId)) {
      expandedTokenIds.value = expandedTokenIds.value.filter(id => id !== tokenId)
    }
    else {
      expandedTokenIds.value = [...expandedTokenIds.value, tokenId]
    }
  }

  function toggleExpandAllTokens(): void {
    const viewIds = viewTokenIds.value

    if (areAllTokensExpanded.value) {
      expandedTokenIds.value = expandedTokenIds.value.filter(id => !viewIds.includes(id))
    }
    else {
      expandedTokenIds.value = Array.from(new Set([...expandedTokenIds.value, ...viewIds]))
    }
  }

  function loadFromHistory(analysis: RussianSentenceAnalysis, query: string): void {
    queryInput.value = query
    errorMessage.value = null
    applyAnalysisResult(analysis)
  }

  function tryApplyCachedAnalysis(text: string): boolean {
    const cleanTarget = stripStressMarks(text).toLowerCase()
    const cachedHistory = history.historyItems.value.find(item => stripStressMarks(item.query).toLowerCase() === cleanTarget
      || stripStressMarks(item.plainText).toLowerCase() === cleanTarget)

    if (cachedHistory) {
      errorMessage.value = null
      applyAnalysisResult(cachedHistory.analysis)

      return true
    }

    return false
  }

  async function requestAndNormalizeAnalysis(text: string): Promise<RussianSentenceAnalysis> {
    const raw = await requestLlmGenerate<unknown>({
      action: 'russian_sentence_deep_analyze',
      systemPrompt: buildRussianAnalyzerSystemPrompt((locale.value as string) || 'en'),
      prompt: buildRussianAnalyzerUserPrompt(text),
      json: true,
      temperature: 0.35,
    })

    if (!raw) {
      throw new Error('Empty LLM response')
    }

    const normalized = normalizeRussianAnalysisResponse(raw, text)

    if (normalized.tokens.length === 0) {
      throw new Error('No tokens parsed')
    }

    return normalized
  }

  async function analyzeSentence(customInput?: string): Promise<boolean> {
    const text = (customInput !== undefined ? customInput : queryInput.value).trim()

    if (!text || isAnalyzing.value) {
      return false
    }

    if (customInput !== undefined) {
      queryInput.value = text
    }

    if (tryApplyCachedAnalysis(text)) {
      return true
    }

    isAnalyzing.value = true
    errorMessage.value = null

    try {
      const normalized = await requestAndNormalizeAnalysis(text)
      applyAnalysisResult(normalized)
      history.saveToHistory(text, normalized)

      return true
    }
    catch (err) {
      console.error('[RussianAnalyzer] Failed to analyze sentence:', err)
      errorMessage.value = t('plugins.russian-analyzer.errorGeneration')

      return false
    }
    finally {
      isAnalyzing.value = false
    }
  }

  return {
    queryInput,
    isAnalyzing,
    errorMessage,
    currentAnalysis,
    viewAnalysis,
    sentenceTabs,
    activeSentenceIndex,
    selectedNode,
    expandedTokenIds,
    areAllTokensExpanded,
    showStressMarks,
    canvasViewMode,
    detectedLanguage,
    history,
    selectNode,
    focusSentence,
    toggleTokenExpand,
    toggleExpandAllTokens,
    loadFromHistory,
    analyzeSentence,
  }
}
