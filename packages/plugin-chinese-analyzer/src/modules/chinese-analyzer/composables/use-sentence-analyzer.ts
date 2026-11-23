import type {
  CanvasSelectedNode,
  CanvasViewMode,
  ChineseSentenceAnalysis,
  LexemeToken,
} from '../model'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_SHOWCASE_ANALYSIS } from '../../../shared/constants/presets'
import {
  buildAnalyzerSystemPrompt,
  buildAnalyzerUserPrompt,
  normalizeAnalysisResponse,
} from '../../../shared/lib/analyzer-prompt'
import { requestLlmGenerate } from '../../../shared/lib/api'
import { getSentenceTabs, sliceAnalysisBySentence } from '../../../shared/lib/sentence-view'
import { detectInputLanguage } from '../../../shared/lib/tone-utils'
import { useAnalyzerHistory } from './use-analyzer-history'

function getInitialSelectedNode(analysis: ChineseSentenceAnalysis): CanvasSelectedNode | null {
  const multiCharToken = analysis.tokens.find(t => t.characters.length >= 2)
  const target = multiCharToken || analysis.tokens[0]

  return target ? { kind: 'token', token: target } : null
}

function getAllTokenIds(tokens: LexemeToken[]): string[] {
  return tokens.map(t => t.id)
}

export function useSentenceAnalyzer() {
  const { locale, t } = useI18n()
  const history = useAnalyzerHistory()

  const queryInput = ref('')
  const isAnalyzing = ref(false)
  const errorMessage = ref<string | null>(null)
  const currentAnalysis = ref<ChineseSentenceAnalysis | null>(null)
  const selectedNode = ref<CanvasSelectedNode | null>(null)
  const expandedTokenIds = ref<string[]>([])
  const canvasViewMode = ref<CanvasViewMode>('hierarchy')
  /** Ключ выбранного предложения; `null` — показывать разбор целиком. */
  const activeSentenceIndex = ref<number | null>(null)

  const detectedLanguage = computed(() => detectInputLanguage(queryInput.value))
  const sentenceTabs = computed(() => currentAnalysis.value ? getSentenceTabs(currentAnalysis.value) : [])
  /** Разбор, который отображается на странице: целиком или срез по активному предложению. */
  const viewAnalysis = computed<ChineseSentenceAnalysis | null>(() => {
    const analysis = currentAnalysis.value
    const index = activeSentenceIndex.value

    return analysis && index !== null ? sliceAnalysisBySentence(analysis, index) : analysis
  })
  const viewTokenIds = computed(() => getAllTokenIds(viewAnalysis.value?.tokens ?? []))
  const areAllTokensExpanded = computed(() => {
    const ids = viewTokenIds.value

    return ids.length > 0 && ids.every(id => expandedTokenIds.value.includes(id))
  })

  function applyAnalysisResult(analysis: ChineseSentenceAnalysis): void {
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

  function loadFromHistory(analysis: ChineseSentenceAnalysis, query: string): void {
    queryInput.value = query
    errorMessage.value = null
    applyAnalysisResult(analysis)
  }

  function tryApplyCachedAnalysis(text: string): boolean {
    if (text === DEFAULT_SHOWCASE_ANALYSIS.sentence.originalInput) {
      errorMessage.value = null
      applyAnalysisResult(DEFAULT_SHOWCASE_ANALYSIS)
      history.saveToHistory(text, DEFAULT_SHOWCASE_ANALYSIS)

      return true
    }

    const cachedHistory = history.historyItems.value.find(item => item.query === text || item.hanzi === text)

    if (cachedHistory) {
      errorMessage.value = null
      applyAnalysisResult(cachedHistory.analysis)

      return true
    }

    return false
  }

  async function requestAndNormalizeAnalysis(text: string): Promise<ChineseSentenceAnalysis> {
    const raw = await requestLlmGenerate<unknown>({
      action: 'chinese_sentence_deep_analyze',
      systemPrompt: buildAnalyzerSystemPrompt((locale.value as string) || 'ru'),
      prompt: buildAnalyzerUserPrompt(text),
      json: true,
      temperature: 0.35,
    })

    if (!raw) {
      throw new Error('Empty LLM response')
    }

    const normalized = normalizeAnalysisResponse(raw, text)

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

    if (tryApplyCachedAnalysis(text))
      return true

    isAnalyzing.value = true
    errorMessage.value = null

    try {
      const normalized = await requestAndNormalizeAnalysis(text)
      applyAnalysisResult(normalized)
      history.saveToHistory(text, normalized)

      return true
    }
    catch (err) {
      console.error('[ChineseAnalyzer] Failed to analyze sentence:', err)
      errorMessage.value = t('plugins.chinese-analyzer.errorGeneration')

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
