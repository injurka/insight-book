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

  let originalOffset = 0
  const offsets: number[] = []
  const endOffsets: number[] = []

  for (const character of fullText) {
    offsets.push(...Array.from<number>({ length: character.toLowerCase().length }).fill(originalOffset))
    originalOffset += character.length
    endOffsets.push(...Array.from<number>({ length: character.toLowerCase().length }).fill(originalOffset))
  }

  return buildRange(textNodes, offsets[lowerStart], endOffsets[lowerStart + lowerSearch.length - 1])
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

/** Returns the smallest saved quote under the pointer, including overlapping quotes. */
export function findQuoteTextAtPoint(target: HTMLElement, x: number, y: number): string | undefined {
  const matches: string[] = []

  for (const colors of ownerRanges.values()) {
    for (const ranges of colors.values()) {
      for (const range of ranges) {
        if (!range.startContainer.isConnected || !range.intersectsNode(target))
          continue

        if (Array.from(range.getClientRects()).some(rect => x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom))
          matches.push(range.toString())
      }
    }
  }

  return matches.sort((a, b) => a.length - b.length)[0]
}

function colorToHighlightName(rgba: string): string {
  return `${HIGHLIGHT_NAME_PREFIX}-${rgba.replace(/[^a-z0-9]+/gi, '-')}`
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
      const canonicalColor = hexToRgba(color, 0.35)
      const list = rangesByColor.get(canonicalColor)

      if (list)
        list.push(...ranges)
      else
        rangesByColor.set(canonicalColor, [...ranges])
    }
  }

  const nextNames = new Set<string>()
  const cssRules: string[] = []

  for (const [color, ranges] of rangesByColor) {
    const name = colorToHighlightName(color)
    nextNames.add(name)
    CSS.highlights.set(name, new Highlight(...ranges))
    cssRules.push(`::highlight(${name}) { background-color: ${color}; color: inherit; }`)
  }

  for (const name of registeredNames) {
    if (!nextNames.has(name))
      CSS.highlights.delete(name)
  }

  registeredNames = nextNames

  if (cssRules.length)
    getStyleElement().textContent = cssRules.join('\n')
  else
    document.getElementById(STYLE_ELEMENT_ID)?.remove()
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
