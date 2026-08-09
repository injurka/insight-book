import type { Highlight, LlmAnalysis, PagePayload } from '~/01.shared/types/models'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useHighlightsStore } from '../store/highlights.store'
import { useReaderStore } from '../store/reader.store'
import { useReaderContent } from './use-reader-content'

// Mock heavy external dependencies pulled in transitively by the stores:
// repositories (IndexedDB / localforage / fetch), analytics and pinia-colada queries.
vi.mock('~/00.plugins/di', () => ({
  useRepos: () => new Proxy({}, {
    get: () => new Proxy({}, {
      get: () => vi.fn(async () => null),
    }),
  }),
}))

vi.mock('~/01.shared/composables/use-tracking', () => ({
  useTracking: () => ({ trackEvent: vi.fn() }),
}))

vi.mock('@pinia/colada', () => ({
  useQuery: () => ({
    data: ref(null),
    isLoading: ref(false),
    refetch: vi.fn(async () => { }),
  }),
  useMutation: () => ({ mutateAsync: vi.fn(async (arg: unknown) => arg) }),
  useQueryCache: () => ({ invalidateQueries: vi.fn() }),
}))

function wordSpan(sentId: string, idx: number, text: string): string {
  return `<span class="word" data-sent-id="${sentId}" data-token-idx="${idx}" data-word="${text}">${text}</span>`
}

function sentenceSpan(sentId: string, words: string[]): string {
  const rawSent = encodeURIComponent(words.join(' '))
  const inner = words.map((w, i) => wordSpan(sentId, i, w)).join(' ')

  return `<span class="sentence" data-sent-id="${sentId}" data-raw-sent="${rawSent}">${inner}</span>`
}

function setPage(inner: string, pageNum = 1) {
  const readerStore = useReaderStore()
  // Wrap in a block element like real page content: DOMPurify under happy-dom
  // strips the first top-level inline element.
  const content = `<div class="page">${inner}</div>`
  readerStore.currentPage = {
    bookId: 1,
    pageNum,
    totalPages: 10,
    content,
  } as PagePayload
}

describe('useReaderContent - applyTranslations (left pane)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    const settingsStore = useGlobalSettingsStore()
    settingsStore.parallelViewMode = 'interleaved'
    settingsStore.showSentenceTtsButton = false
    settingsStore.parallelBlurTranslation = false
    settingsStore.parallelShowGrammar = false
  })

  it('inserts an interleaved-translation span after a translated sentence', () => {
    setPage(sentenceSpan('s1', ['hello', 'world']))
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = [
      { sentence: 'hello world', analysis: { translation: 'привет мир' } as LlmAnalysis, timestamp: 1 },
    ]

    const { leftPaneContent } = useReaderContent()
    const html = leftPaneContent.value

    expect(html).toContain('class="interleaved-translation ')
    expect(html).toContain('<span class="translation-text">привет мир</span>')
    // translation must be placed after the sentence, not inside it
    expect(html.indexOf('</span><span class="interleaved-translation')).toBeGreaterThan(-1)
  })

  it('does not insert translations or highlights when lists are empty', () => {
    setPage(sentenceSpan('s1', ['hello', 'world']))

    const { leftPaneContent } = useReaderContent()
    const html = leftPaneContent.value

    expect(html).not.toContain('interleaved-translation')
    expect(html).not.toContain('exact-highlight')
    expect(html).not.toContain('sentence-tts-btn')
  })

  it('escapes HTML in the translation text', () => {
    setPage(sentenceSpan('s1', ['hello', 'world']))
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = [
      { sentence: 'hello world', analysis: { translation: '<img src=x onerror=alert(1)>' } as LlmAnalysis, timestamp: 1 },
    ]

    const { leftPaneContent } = useReaderContent()
    const html = leftPaneContent.value

    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('does not bake highlights into the HTML (they are applied via CSS Custom Highlight API)', () => {
    setPage(sentenceSpan('s1', ['hello', 'brave', 'world']))
    const highlightsStore = useHighlightsStore()
    highlightsStore.highlights = [
      {
        id: 1,
        bookId: 1,
        text: 'brave',
        color: '#fde047',
        pageNum: 1,
      } as Highlight,
    ]

    const { leftPaneContent } = useReaderContent()
    const html = leftPaneContent.value

    expect(html).not.toContain('exact-highlight')
    expect(html).toMatch(/class="word"[^>]*>brave<\/span>/)
  })

  it('produces identical output on repeated reads (no duplicated insertions)', () => {
    setPage(sentenceSpan('s1', ['hello', 'world']))
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = [
      { sentence: 'hello world', analysis: { translation: 'привет мир' } as LlmAnalysis, timestamp: 1 },
    ]

    const { leftPaneContent } = useReaderContent()
    const first = leftPaneContent.value
    const second = leftPaneContent.value

    expect(first).toBe(second)
    expect((second.match(/interleaved-translation/g) || []).length).toBe(1)
  })

  it('inserts translation only once for duplicate data-sent-id in one pass', () => {
    const content = sentenceSpan('s1', ['hello', 'world']) + sentenceSpan('s1', ['hello', 'world'])
    setPage(content)
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = [
      { sentence: 'hello world', analysis: { translation: 'привет мир' } as LlmAnalysis, timestamp: 1 },
    ]

    const { leftPaneContent } = useReaderContent()
    expect((leftPaneContent.value.match(/interleaved-translation/g) || []).length).toBe(1)
  })

  it('adds is-blurred class and grammar badges when settings are enabled', () => {
    const settingsStore = useGlobalSettingsStore()
    settingsStore.parallelBlurTranslation = true
    settingsStore.parallelShowGrammar = true
    setPage(sentenceSpan('s1', ['hello', 'world']))
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = [
      {
        sentence: 'hello world',
        analysis: {
          translation: 'привет мир',
          grammarRules: [{ pattern: 'hello + noun', explanation: 'greeting', example: 'hello world' }],
        } as LlmAnalysis,
        timestamp: 1,
      },
    ]

    const { leftPaneContent } = useReaderContent()
    const html = leftPaneContent.value

    expect(html).toContain('interleaved-translation is-blurred')
    expect(html).toContain('class="grammar-rules-container"')
    expect(html).toContain('class="grammar-rule-badge"')
  })

  it('inserts a sentence TTS button when the setting is enabled', () => {
    const settingsStore = useGlobalSettingsStore()
    settingsStore.showSentenceTtsButton = true
    setPage(sentenceSpan('s1', ['hello', 'world']))

    const { leftPaneContent } = useReaderContent()
    const html = leftPaneContent.value

    expect(html).toContain('class="sentence-tts-btn"')
    expect(html).toContain(`data-tts-text="${encodeURIComponent('hello world')}"`)
  })
})

describe('useReaderContent - applyTranslations (right pane, split mode)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    const settingsStore = useGlobalSettingsStore()
    settingsStore.parallelViewMode = 'split'
    settingsStore.parallelBlurTranslation = false
    settingsStore.parallelShowGrammar = false
  })

  it('replaces translated sentence content with split-translation and has-translation class', () => {
    setPage(sentenceSpan('s1', ['hello', 'world']))
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = [
      { sentence: 'hello world', analysis: { translation: 'привет мир' } as LlmAnalysis, timestamp: 1 },
    ]

    const { translatedPageContent } = useReaderContent()
    const html = translatedPageContent.value

    expect(html).toContain('class="sentence has-translation"')
    expect(html).toContain('class="split-translation ')
    expect(html).toContain('<span class="translation-text">привет мир</span>')
  })

  it('wraps untranslated sentences in untranslated-text', () => {
    setPage(sentenceSpan('s1', ['hello', 'world']))

    const { translatedPageContent } = useReaderContent()
    const html = translatedPageContent.value

    expect(html).toContain('class="untranslated-text"')
    expect(html).not.toContain('split-translation')
  })

  it('hides a sentence whose data-sent-id was already translated in the same pass', () => {
    const content = sentenceSpan('s1', ['hello', 'world']) + sentenceSpan('s1', ['hello', 'world'])
    setPage(content)
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = [
      { sentence: 'hello world', analysis: { translation: 'привет мир' } as LlmAnalysis, timestamp: 1 },
    ]

    const { translatedPageContent } = useReaderContent()
    const html = translatedPageContent.value

    expect((html.match(/split-translation/g) || []).length).toBe(1)
    expect(html).toContain('style="display: none;"')
  })

  it('returns empty content when not in parallel (split) view', () => {
    const settingsStore = useGlobalSettingsStore()
    settingsStore.parallelViewMode = 'interleaved'
    setPage(sentenceSpan('s1', ['hello', 'world']))

    const { translatedPageContent } = useReaderContent()
    expect(translatedPageContent.value).toBe('')
  })
})

describe('useReaderContent - pageTranslationProgress', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('computes progress from translated sentences on the page', () => {
    const content = sentenceSpan('s1', ['hello', 'world']) + sentenceSpan('s2', ['goodbye', 'world'])
    setPage(content)
    const analysisStore = useAnalysisStore()
    analysisStore.analysisHistory = [
      { sentence: 'hello world', analysis: { translation: 'x' } as LlmAnalysis, timestamp: 1 },
    ]

    const { pageTranslationProgress } = useReaderContent()
    const progress = pageTranslationProgress.value

    expect(progress.total).toBe(2)
    expect(progress.translated).toBe(1)
    expect(progress.percentage).toBe(50)
    expect(progress.isFullyTranslated).toBe(false)
  })

  it('treats a page without sentences as fully translated', () => {
    setPage('<p>no sentences here</p>')

    const { pageTranslationProgress } = useReaderContent()
    expect(pageTranslationProgress.value).toEqual({
      total: 0,
      translated: 0,
      percentage: 100,
      isFullyTranslated: true,
    })
  })
})
