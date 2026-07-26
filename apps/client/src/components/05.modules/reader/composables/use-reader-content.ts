import DOMPurify from 'dompurify'
import { computed } from 'vue'
import { normalizeString } from '~/shared/lib/helpers'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { highlightExactText } from '../lib/dom-highlighter'
import { useHighlightsStore } from '../store/highlights.store'
import { useReaderStore } from '../store/reader.store'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function useReaderContent() {
  const readerStore = useReaderStore()
  const analysisStore = useAnalysisStore()
  const highlightsStore = useHighlightsStore()
  const settingsStore = useGlobalSettingsStore()

  const translationMap = computed(() => {
    const map: Record<string, any> = {}
    for (const item of analysisStore.analysisHistory) {
      map[item.sentence] = item.analysis
    }
    return map
  })

  const safePageContent = computed(() => {
    if (!readerStore.currentPage?.content)
      return ''
    return DOMPurify.sanitize(readerStore.currentPage.content, {
      ADD_ATTR: ['data-sent-id', 'data-raw-sent', 'data-word', 'data-pos', 'data-token-idx'],
    })
  })

  function applyHighlightsAndTranslations(doc: Document, map: Record<string, any>, pageNum: number, mode: 'left' | 'right') {
    const pageHighlights = highlightsStore.highlights.filter(h => Number(h.pageNum) === pageNum)
    const translatedSentIds = new Set<string>()

    doc.querySelectorAll('.sentence').forEach((span) => {
      const rawSent = decodeURIComponent(span.getAttribute('data-raw-sent') || '')
      const sentId = span.getAttribute('data-sent-id') || ''
      const rawNorm = normalizeString(rawSent)

      const matchingHighlights = pageHighlights.filter((h) => {
        const hNorm = normalizeString(h.text)
        return rawNorm === hNorm || (hNorm.length >= 2 && (rawNorm.includes(hNorm) || hNorm.includes(rawNorm)))
      })

      if (settingsStore.highlightSavedQuotes) {
        matchingHighlights.forEach((matching) => {
          highlightExactText(span as HTMLElement, matching.text, matching.color || '#fde047')
        })
      }

      if (mode === 'left') {
        if (settingsStore.showSentenceTtsButton && rawSent) {
          const ttsBtnHtml = `<button class="sentence-tts-btn" data-tts-text="${encodeURIComponent(rawSent)}" type="button"><svg class="icon-play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.71V20.77C18.03,19.86 21,16.28 21,12C21,7.72 18.03,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/></svg><svg class="icon-playing" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M18,18H6V6H18V18Z"/></svg></button>`
          span.insertAdjacentHTML('beforeend', ttsBtnHtml)
        }

        if (settingsStore.parallelViewMode === 'interleaved' && map[rawSent] && !translatedSentIds.has(sentId)) {
          const blurClass = settingsStore.parallelBlurTranslation ? 'is-blurred' : ''
          const analysisObj = map[rawSent]
          const translationText = analysisObj.translation || ''

          let grammarHtml = ''
          if (settingsStore.parallelShowGrammar && analysisObj.grammarRules && analysisObj.grammarRules.length > 0) {
            const badges = analysisObj.grammarRules.map((rule: any) => {
              const patternEscaped = encodeURIComponent(rule.pattern || '')
              const explanationEscaped = encodeURIComponent(rule.explanation || '')
              const exampleEscaped = encodeURIComponent(rule.example || '')
              return `<span class="grammar-rule-badge" data-pattern="${patternEscaped}" data-explanation="${explanationEscaped}" data-example="${exampleEscaped}">${escapeHtml(rule.pattern)}</span>`
            }).join('')
            grammarHtml = `<span class="grammar-rules-container">${badges}</span>`
          }

          const translationHtml = `<span class="interleaved-translation ${blurClass}" onclick="this.classList.remove('is-blurred')"><span class="translation-text">${translationText}</span>${grammarHtml}</span>`
          span.insertAdjacentHTML('afterend', translationHtml)
          translatedSentIds.add(sentId)
        }
      }
      else if (mode === 'right') {
        if (map[rawSent]) {
          const analysisObj = map[rawSent]
          const translationText = analysisObj.translation || ''
          if (translatedSentIds.has(sentId)) {
            span.innerHTML = '';
            (span as any).style.display = 'none'
          }
          else {
            const blurClass = settingsStore.parallelBlurTranslation ? 'is-blurred' : ''

            let grammarHtml = ''
            if (settingsStore.parallelShowGrammar && analysisObj.grammarRules && analysisObj.grammarRules.length > 0) {
              const badges = analysisObj.grammarRules.map((rule: any) => {
                const patternEscaped = encodeURIComponent(rule.pattern || '')
                const explanationEscaped = encodeURIComponent(rule.explanation || '')
                const exampleEscaped = encodeURIComponent(rule.example || '')
                return `<span class="grammar-rule-badge" data-pattern="${patternEscaped}" data-explanation="${explanationEscaped}" data-example="${exampleEscaped}">${escapeHtml(rule.pattern)}</span>`
              }).join('')
              grammarHtml = `<span class="grammar-rules-container">${badges}</span>`
            }

            span.innerHTML = `<span class="split-translation ${blurClass}" onclick="this.classList.remove('is-blurred')"><span class="translation-text">${translationText}</span>${grammarHtml}</span>`
            span.classList.add('has-translation')
            translatedSentIds.add(sentId)
          }
        }
        else {
          span.innerHTML = `<span class="untranslated-text">${span.innerHTML}</span>`
        }
      }
    })
  }

  const leftPaneContent = computed(() => {
    if (!safePageContent.value)
      return ''
    const parser = new DOMParser()
    const doc = parser.parseFromString(safePageContent.value, 'text/html')
    applyHighlightsAndTranslations(doc, translationMap.value, Number(readerStore.currentPage?.pageNum), 'left')
    return doc.body.innerHTML
  })

  const translatedPageContent = computed(() => {
    if (!safePageContent.value || !readerStore.isParallelView)
      return ''
    const parser = new DOMParser()
    const doc = parser.parseFromString(safePageContent.value, 'text/html')
    applyHighlightsAndTranslations(doc, translationMap.value, Number(readerStore.currentPage?.pageNum), 'right')
    return doc.body.innerHTML
  })

  const parallelTranslations = computed(() => {
    if (settingsStore.parallelViewMode === 'none' || !readerStore.currentPage?.ocrBlocks) {
      return []
    }
    const map = translationMap.value
    const parser = new DOMParser()
    const pageNum = Number(readerStore.currentPage?.pageNum)

    return readerStore.currentPage.ocrBlocks.map((box) => {
      let resultHtml = ''
      if (box.html) {
        const doc = parser.parseFromString(box.html, 'text/html')
        applyHighlightsAndTranslations(doc, map, pageNum, 'right')
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

    const sentRegex = /data-raw-sent="([^"]+)"/g
    let match
    let total = 0
    let translated = 0
    const map = translationMap.value

    // eslint-disable-next-line no-cond-assign
    while ((match = sentRegex.exec(safePageContent.value)) !== null) {
      total++
      const rawSent = decodeURIComponent(match[1])
      if (map[rawSent]) {
        translated++
      }
    }

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
