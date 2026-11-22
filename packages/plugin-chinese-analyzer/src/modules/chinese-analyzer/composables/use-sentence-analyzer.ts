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
  const currentAnalysis = ref<ChineseSentenceAnalysis>(DEFAULT_SHOWCASE_ANALYSIS)
  const selectedNode = ref<CanvasSelectedNode | null>(getInitialSelectedNode(DEFAULT_SHOWCASE_ANALYSIS))
  const expandedTokenIds = ref<string[]>(getAllTokenIds(DEFAULT_SHOWCASE_ANALYSIS.tokens))
  const showTraditional = ref(false)
  const canvasViewMode = ref<CanvasViewMode>('hierarchy')

  const detectedLanguage = computed(() => detectInputLanguage(queryInput.value))
  const areAllTokensExpanded = computed(() => {
    const tokens = currentAnalysis.value.tokens

    return tokens.length > 0 && expandedTokenIds.value.length >= tokens.length
  })

  function applyAnalysisResult(analysis: ChineseSentenceAnalysis): void {
    currentAnalysis.value = analysis
    expandedTokenIds.value = getAllTokenIds(analysis.tokens)
    selectedNode.value = getInitialSelectedNode(analysis)
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
    if (areAllTokensExpanded.value) {
      expandedTokenIds.value = []
    }
    else {
      expandedTokenIds.value = getAllTokenIds(currentAnalysis.value.tokens)
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

  async function analyzeSentence(customInput?: string): Promise<void> {
    const text = (customInput !== undefined ? customInput : queryInput.value).trim()

    if (!text || isAnalyzing.value) {
      return
    }

    if (customInput !== undefined) {
      queryInput.value = text
    }

    if (tryApplyCachedAnalysis(text)) {
      return
    }

    isAnalyzing.value = true
    errorMessage.value = null

    try {
      const normalized = await requestAndNormalizeAnalysis(text)
      applyAnalysisResult(normalized)
      history.saveToHistory(text, normalized)
    }
    catch (err) {
      console.error('[ChineseAnalyzer] Failed to analyze sentence:', err)
      errorMessage.value = t('plugins.chinese-analyzer.errorGeneration')
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
    selectedNode,
    expandedTokenIds,
    areAllTokensExpanded,
    showTraditional,
    canvasViewMode,
    detectedLanguage,
    history,
    selectNode,
    toggleTokenExpand,
    toggleExpandAllTokens,
    loadFromHistory,
    analyzeSentence,
  }
}
