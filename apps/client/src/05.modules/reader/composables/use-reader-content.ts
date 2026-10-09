import type { Ref } from 'vue'
import type { LlmAnalysis, PagePayload } from '~/01.shared/types/models'
import DOMPurify from 'dompurify'
import { computed } from 'vue'
import { safeDecodeURIComponent } from '~/01.shared/lib/helpers'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useReaderStore } from '../store/reader.store'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function useReaderContent(pageSource?: Ref<PagePayload | null | undefined> | (() => PagePayload | null | undefined)) {
  const readerStore = useReaderStore()
  const analysisStore = useAnalysisStore()
  const settingsStore = useGlobalSettingsStore()

  const currentPage = computed<PagePayload | null>(() => {
    if (pageSource) {
      return (typeof pageSource === 'function' ? pageSource() : pageSource.value) || null
    }

    return readerStore.currentPage
  })

  const translationMap = computed(() => {
    const map: Record<string, LlmAnalysis> = {}

    for (const item of analysisStore.analysisHistory)
      map[item.sentence] = item.analysis

    return map
  })

  const safePageContent = computed(() => {
    if (!currentPage.value?.content)
      return ''

    return DOMPurify.sanitize(currentPage.value.content, {
      ADD_ATTR: ['data-sent-id', 'data-raw-sent', 'data-word', 'data-pos', 'data-token-idx'],
    })
  })

  function buildGrammarHtml(rules?: { pattern?: string, explanation?: string, example?: string }[]): string {
    if (!settingsStore.parallelShowGrammar || !rules || rules.length === 0)
      return ''

    const badges = rules.map((rule) => {
      const patternEscaped = encodeURIComponent(rule.pattern || '')
      const explanationEscaped = encodeURIComponent(rule.explanation || '')
      const exampleEscaped = encodeURIComponent(rule.example || '')

      return `<span class="grammar-rule-badge" data-pattern="${patternEscaped}" data-explanation="${explanationEscaped}" data-example="${exampleEscaped}">${escapeHtml(rule.pattern || '')}</span>`
    }).join('')

    return `<span class="grammar-rules-container">${badges}</span>`
  }

  function processLeftSpan(span: Element, rawSent: string, map: Record<string, LlmAnalysis>) {
    if (settingsStore.showSentenceTtsButton && rawSent) {
      const ttsBtnHtml = `<button class="sentence-tts-btn" data-tts-text="${encodeURIComponent(rawSent)}" type="button"><svg class="icon-play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.03,19.86 21,16.28 21,12C21,7.72 18.03,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/></svg><svg class="icon-playing" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M18,18H6V6H18V18Z"/></svg></button>`
      span.insertAdjacentHTML('beforeend', ttsBtnHtml)
    }

    if (settingsStore.parallelViewMode === 'interleaved' && map[rawSent]) {
      const blurClass = settingsStore.parallelBlurTranslation ? 'is-blurred' : ''
      const analysisObj = map[rawSent]
      const grammarHtml = buildGrammarHtml(analysisObj.grammarRules)
      const translationHtml = `<span class="interleaved-translation ${blurClass}"><span class="translation-text">${escapeHtml(analysisObj.translation || '')}</span>${grammarHtml}</span>`
      span.insertAdjacentHTML('afterend', translationHtml)
    }
  }

  function processRightSpan(
    span: Element,
    rawSent: string,
    sentId: string,
    map: Record<string, LlmAnalysis>,
    translatedSentIds: Set<string>,
  ) {
    if (map[rawSent]) {
      const analysisObj = map[rawSent]

      if (translatedSentIds.has(sentId)) {
        span.innerHTML = '';
        (span as HTMLElement).style.display = 'none'
      }
      else {
        const blurClass = settingsStore.parallelBlurTranslation ? 'is-blurred' : ''
        const grammarHtml = buildGrammarHtml(analysisObj.grammarRules)
        span.innerHTML = `<span class="split-translation ${blurClass}"><span class="translation-text">${escapeHtml(analysisObj.translation || '')}</span>${grammarHtml}</span>`
        span.classList.add('has-translation')
        translatedSentIds.add(sentId)
      }
    }
    else {
      span.innerHTML = `<span class="untranslated-text">${span.innerHTML}</span>`
    }
  }

  function applyTranslations(doc: Document, map: Record<string, LlmAnalysis>, mode: 'left' | 'right') {
    const translatedSentIds = new Set<string>()

    const spans = [...doc.querySelectorAll('.sentence')]
    // Inline formatting can split one logical sentence into multiple DOM spans.
    // Only its final fragment receives TTS and the interleaved translation.
    const lastFragments = new Map<string, Element>()
    const sentenceKey = (span: Element, index: number) => span.getAttribute('data-sent-id') || `fragment-${index}`
    spans.forEach((span, index) => lastFragments.set(sentenceKey(span, index), span))

    spans.forEach((span, index) => {
      const rawSent = safeDecodeURIComponent(span.getAttribute('data-raw-sent') || '')
      const sentId = sentenceKey(span, index)

      if (mode === 'left') {
        if (lastFragments.get(sentId) === span)
          processLeftSpan(span, rawSent, map)
      }
      else if (mode === 'right') {
        processRightSpan(
          span,
          rawSent,
          sentId,
          map,
          translatedSentIds,
        )
      }
    })
  }

  const leftPaneContent = computed(() => {
    if (!safePageContent.value)
      return ''

    const parser = new DOMParser()
    const doc = parser.parseFromString(safePageContent.value, 'text/html')
    applyTranslations(doc, translationMap.value, 'left')

    return doc.body.innerHTML
  })

  const translatedPageContent = computed(() => {
    if (!safePageContent.value || !readerStore.isParallelView)
      return ''

    const parser = new DOMParser()
    const doc = parser.parseFromString(safePageContent.value, 'text/html')
    applyTranslations(doc, translationMap.value, 'right')

    return doc.body.innerHTML
  })

  const parallelTranslations = computed(() => {
    if (settingsStore.parallelViewMode === 'none' || !currentPage.value?.ocrBlocks)
      return []

    const map = translationMap.value
    const parser = new DOMParser()

    return currentPage.value.ocrBlocks.map((box) => {
      let resultHtml = ''

      if (box.html) {
        const doc = parser.parseFromString(box.html, 'text/html')
        applyTranslations(doc, map, 'right')
        resultHtml = doc.body.innerHTML
      }
      else {
        resultHtml = `<span class="untranslated-text">${box.text.replace(/\n+/g, '')}</span>`
      }

      return {
        id: box.id,
        text: box.text,
        html: resultHtml,
      }
    })
  })

  const pageTranslationProgress = computed(() => {
    if (!safePageContent.value)
      return { total: 0, translated: 0, percentage: 0, isFullyTranslated: false }

    const doc = new DOMParser().parseFromString(safePageContent.value, 'text/html')
    const sentences = new Map<string, string>()
    doc.querySelectorAll('.sentence[data-raw-sent]').forEach((span, index) => {
      const rawSent = safeDecodeURIComponent(span.getAttribute('data-raw-sent') || '')

      if (rawSent)
        sentences.set(span.getAttribute('data-sent-id') || `fragment-${index}`, rawSent)
    })
    const total = sentences.size
    const map = translationMap.value
    const translated = [...sentences.values()].filter(sentence => map[sentence]).length

    if (total === 0)
      return { total: 0, translated: 0, percentage: 100, isFullyTranslated: true }

    return {
      total,
      translated,
      percentage: Math.round((translated / total) * 100),
      isFullyTranslated: translated === total,
    }
  })

  return {
    leftPaneContent,
    translatedPageContent,
    parallelTranslations,
    pageTranslationProgress,
  }
}
