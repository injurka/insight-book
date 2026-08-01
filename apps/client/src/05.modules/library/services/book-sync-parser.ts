import type { PagePayload } from '~/01.shared/types/models'

export interface ExtractPageDataOptions {
  extractSentences: boolean
  extractWords: boolean
}

export interface ExtractedPageData {
  sentences: string[]
  words: string[]
}

const HAS_LETTER_OR_DIGIT_REGEX = /[\p{L}\p{N}]/u

function extractFromHtml(
  html: string,
  options: ExtractPageDataOptions,
  sentences: Set<string>,
  words: Set<string>,
): void {
  if (options.extractSentences) {
    const sentRegex = /data-raw-sent="([^"]+)"/g
    let match
    // eslint-disable-next-line no-cond-assign
    while ((match = sentRegex.exec(html)) !== null)
      sentences.add(decodeURIComponent(match[1]))
  }

  if (options.extractWords) {
    const wordRegex = /data-word="([^"]+)"[^>]*?data-pos="([^"]+)"/g
    let match
    // eslint-disable-next-line no-cond-assign
    while ((match = wordRegex.exec(html)) !== null) {
      // Пропускаем служебные части речи (частицы и т.п.)
      if (match[2] !== 'x')
        words.add(decodeURIComponent(match[1]))
    }
  }
}

/**
 * Извлекает уникальные предложения и слова из HTML-контента страницы
 * (или из OCR-блоков для manga-страниц). Чистая функция без доступа
 * к API, БД и UI — безопасна для выноса в worker.
 */
export function extractPageData(page: PagePayload, options: ExtractPageDataOptions): ExtractedPageData {
  const pageSentences = new Set<string>()
  const pageWords = new Set<string>()

  if (page.type === 'manga' && page.ocrBlocks) {
    page.ocrBlocks.forEach((b) => {
      if (b.html) {
        extractFromHtml(
          b.html,
          options,
          pageSentences,
          pageWords,
        )
      }
    })
  }
  else if (page.content) {
    extractFromHtml(
      page.content,
      options,
      pageSentences,
      pageWords,
    )
  }

  return {
    sentences: Array.from(pageSentences).filter(s => HAS_LETTER_OR_DIGIT_REGEX.test(s)),
    words: Array.from(pageWords).filter(w => HAS_LETTER_OR_DIGIT_REGEX.test(w)),
  }
}
