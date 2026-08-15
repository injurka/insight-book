import { hexToRgba, normalizeString, safeDecodeURIComponent } from '~/01.shared/lib/helpers'

export interface QuoteHighlightSource {
  text: string
  color?: string | null
}

const DEFAULT_COLOR = '#fde047'
const HIGHLIGHT_NAME_PREFIX = 'saved-quote'
const STYLE_ELEMENT_ID = 'saved-quote-highlight-styles'

function isHighlightApiSupported(): boolean {
  return typeof Highlight !== 'undefined' && typeof CSS !== 'undefined' && !!CSS.highlights
}

function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let node: Text | null
  // eslint-disable-next-line no-cond-assign, no-unmodified-loop-condition
  while ((node = walker.nextNode() as Text | null))
    textNodes.push(node)

  return textNodes
}

function buildRange(textNodes: Text[], startIndex: number, endIndex: number): Range | null {
  const range = new Range()
  let currentIndex = 0
  let started = false

  for (const textNode of textNodes) {
    const nodeLength = textNode.nodeValue?.length || 0
    const nodeStart = currentIndex
    const nodeEnd = currentIndex + nodeLength

    if (!started && nodeEnd > startIndex) {
      range.setStart(textNode, Math.max(0, startIndex - nodeStart))
      started = true
    }

    if (started && nodeEnd >= endIndex) {
      range.setEnd(textNode, Math.min(nodeLength, endIndex - nodeStart))

      return range
    }

    currentIndex = nodeEnd
  }

  return null
}

/**
 * Ищет первое вхождение текста внутри живого DOM-поддерева и возвращает
 * Range, ничего не меняя в дереве. Сначала точное совпадение,
 * затем — без учета регистра (как в прежней DOM-реализации).
 */
export function findQuoteRange(root: HTMLElement, textToHighlight: string): Range | null {
  if (!textToHighlight)
    return null

  const textNodes = collectTextNodes(root)
  const fullText = textNodes.map(node => node.nodeValue || '').join('')

  const startIndex = fullText.indexOf(textToHighlight)
  if (startIndex !== -1)
    return buildRange(textNodes, startIndex, startIndex + textToHighlight.length)

  const lowerFull = fullText.toLowerCase()
  const lowerSearch = textToHighlight.toLowerCase()
  const lowerStart = lowerFull.indexOf(lowerSearch)
  if (lowerStart === -1)
    return null

  return buildRange(textNodes, lowerStart, lowerStart + lowerSearch.length)
}

/**
 * Собирает Range-ы сохраненных цитат по всем предложениям (.sentence) внутри
 * root и группирует их по цвету. Сопоставление цитат с предложениями — по
 * нормализованному data-raw-sent, как в прежней реализации.
 */
export function collectQuoteRanges(root: HTMLElement, quotes: QuoteHighlightSource[]): Map<string, Range[]> {
  const rangesByColor = new Map<string, Range[]>()
  const validQuotes = quotes.filter(quoteItem => quoteItem.text)
  if (validQuotes.length === 0)
    return rangesByColor

  root.querySelectorAll('.sentence').forEach((span) => {
    const rawSent = safeDecodeURIComponent(span.getAttribute('data-raw-sent') || '')
    const rawNorm = normalizeString(rawSent)

    const matchingQuotes = validQuotes.filter((quoteItem) => {
      const qNorm = normalizeString(quoteItem.text)

      return rawNorm === qNorm || (qNorm.length >= 2 && (rawNorm.includes(qNorm) || qNorm.includes(rawNorm)))
    })

    for (const quote of matchingQuotes) {
      const range = findQuoteRange(span as HTMLElement, quote.text)
      if (range) {
        const color = quote.color || DEFAULT_COLOR
        const list = rangesByColor.get(color)
        if (list)
          list.push(range)
        else
          rangesByColor.set(color, [range])
      }
    }
  })

  return rangesByColor
}

// Реестр Range-ей по "владельцам" (экземплярам представлений). Итоговые
// Highlight-объекты пересобираются из всех владельцев, чтобы несколько
// представлений могли подсвечивать одновременно, не затирая друг друга.
const ownerRanges = new Map<string, Map<string, Range[]>>()
let registeredNames = new Set<string>()

function colorToHighlightName(color: string): string {
  const rgba = hexToRgba(color, 0.35)

  return `${HIGHLIGHT_NAME_PREFIX}-${rgba.replace(/[^a-z0-9]/gi, '')}`
}

function getStyleElement(): HTMLStyleElement {
  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_ELEMENT_ID
    document.head.appendChild(styleEl)
  }

  return styleEl
}

function rebuildRegistry(): void {
  if (!isHighlightApiSupported())
    return

  const rangesByColor = new Map<string, Range[]>()
  for (const ownerMap of ownerRanges.values()) {
    for (const [color, ranges] of ownerMap) {
      const list = rangesByColor.get(color)
      if (list)
        list.push(...ranges)
      else
        rangesByColor.set(color, [...ranges])
    }
  }

  const nextNames = new Set<string>()
  const cssRules: string[] = []

  for (const [color, ranges] of rangesByColor) {
    const name = colorToHighlightName(color)
    nextNames.add(name)
    CSS.highlights.set(name, new Highlight(...ranges))
    cssRules.push(`::highlight(${name}) { background-color: ${hexToRgba(color, 0.35)}; color: inherit; }`)
  }

  for (const name of registeredNames) {
    if (!nextNames.has(name))
      CSS.highlights.delete(name)
  }

  registeredNames = nextNames

  getStyleElement().textContent = cssRules.join('\n')
}

export function setQuoteHighlights(owner: string, rangesByColor: Map<string, Range[]>): void {
  if (rangesByColor.size === 0)
    ownerRanges.delete(owner)
  else
    ownerRanges.set(owner, rangesByColor)
  rebuildRegistry()
}

export function clearQuoteHighlights(owner: string): void {
  if (ownerRanges.delete(owner))
    rebuildRegistry()
}
