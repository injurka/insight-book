/**
 * Code block highlighting using highlight.js (~30KB vs shiki's 10MB).
 * Replaces the shiki Web Worker with a synchronous in-thread highlighter.
 *
 * Used in the reader to highlight code blocks in book content.
 */
import { HighlightEngine } from './highlight-engine'

let enginePromise: Promise<HighlightEngine> | null = null

function getEngine(): Promise<HighlightEngine> {
  if (!enginePromise) {
    enginePromise = HighlightEngine.create()
  }

  return enginePromise
}

/**
 * Scans a container for code blocks and highlights them.
 * Runs in the main thread — fast enough for typical book code snippets.
 */
function extractLang(parentPre: HTMLElement, codeEl: HTMLElement): string | undefined {
  const classNames = `${parentPre.className} ${codeEl.className}`
  const langMatch = classNames.match(/language-([\w-]+)/) || classNames.match(/lang-([\w-]+)/)
  if (langMatch && langMatch[1] && langMatch[1] !== 'undefined')
    return langMatch[1]

  return undefined
}

function processPreElement(parentPre: HTMLPreElement, engine: HighlightEngine, isDarkTheme: boolean) {
  const codeEl = parentPre.querySelector('code') || parentPre
  const text = codeEl.textContent || ''
  if (!text.trim())
    return

  const lang = extractLang(parentPre, codeEl)

  try {
    const result = engine.highlight(text, lang)
    if (result) {
      parentPre.innerHTML = result.value
      parentPre.classList.add('hljs')
      if (isDarkTheme)
        parentPre.classList.add('hljs-dark')
    }
  }
  catch (e) {
    console.warn('[Highlighter] Failed to highlight block:', e)
  }
}

/**
 * Scans a container for code blocks and highlights them.
 * Runs in the main thread — fast enough for typical book code snippets.
 */
export async function highlightCodeBlocks(container: HTMLElement, isDarkTheme = false): Promise<void> {
  const codeBlocks = container.querySelectorAll<HTMLElement>('pre code, pre[class*="language-"]')
  if (codeBlocks.length === 0)
    return

  const engine = await getEngine()
  const processedPres = new Set<HTMLPreElement>()

  for (const el of codeBlocks) {
    const parentPre = el.closest('pre')
    if (parentPre && !processedPres.has(parentPre)) {
      processedPres.add(parentPre)
      processPreElement(parentPre, engine, isDarkTheme)
    }
  }
}
