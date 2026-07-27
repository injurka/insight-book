import type { BundledLanguage, BundledTheme, Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

const SUPPORTED_LANGS: BundledLanguage[] = [
  'javascript',
  'typescript',
  'python',
  'html',
  'css',
  'json',
  'bash',
  'sql',
  'c',
  'cpp',
  'csharp',
  'java',
  'go',
  'rust',
  'xml',
  'yaml',
  'markdown',
]

/**
 * Lazy loads Shiki highlighter on demand.
 * Only downloads Shiki dependencies when code blocks are actually encountered.
 */
export async function getLazyHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = (async () => {
      const { createHighlighter } = await import('shiki')

      return await createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: SUPPORTED_LANGS,
      })
    })()
  }

  return highlighterPromise
}

/**
 * Scans a container element for code blocks (<pre><code>, <pre class="language-...">)
 * and highlights them using Shiki.
 */
export async function highlightCodeBlocks(container: HTMLElement, isDarkTheme = false): Promise<void> {
  // Select code elements or pre elements containing code
  const codeBlocks = container.querySelectorAll<HTMLElement>('pre code, pre[class*="language-"]')
  if (codeBlocks.length === 0)
    return

  try {
    const highlighter = await getLazyHighlighter()
    const theme: BundledTheme = isDarkTheme ? 'github-dark' : 'github-light'
    const loadedLangs = highlighter.getLoadedLanguages()

    // To prevent processing the same pre multiple times if it matched both pre and code selectors
    const processedPres = new Set<HTMLPreElement>()

    codeBlocks.forEach((el) => {
      const parentPre = el.closest('pre')
      if (!parentPre || processedPres.has(parentPre))
        return

      processedPres.add(parentPre)

      // Find code element or fallback to pre
      const codeEl = parentPre.querySelector('code') || parentPre

      // Detect language class from code or pre
      const classNames = `${parentPre.className} ${codeEl.className}`
      const langMatch = classNames.match(/language-([\w-]+)/)
        || classNames.match(/lang-([\w-]+)/)

      let lang = 'javascript'
      if (langMatch && langMatch[1] && langMatch[1] !== 'undefined') {
        const rawLang = langMatch[1].toLowerCase()
        if (loadedLangs.includes(rawLang)) {
          lang = rawLang
        }
        else if (rawLang === 'js') {
          lang = 'javascript'
        }
        else if (rawLang === 'ts') {
          lang = 'typescript'
        }
        else if (rawLang === 'py') {
          lang = 'python'
        }
      }

      const codeText = codeEl.textContent || ''
      if (!codeText.trim())
        return

      try {
        const highlightedHtml = highlighter.codeToHtml(codeText, {
          lang,
          theme,
        })

        // Replace pre with generated Shiki HTML
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = highlightedHtml
        const newPre = tempDiv.firstElementChild as HTMLPreElement | null

        if (newPre) {
          // Preserve any custom reader dataset attributes if present
          Array.from(parentPre.attributes).forEach((attr) => {
            if (attr.name.startsWith('data-') && !newPre.hasAttribute(attr.name)) {
              newPre.setAttribute(attr.name, attr.value)
            }
          })
          parentPre.replaceWith(newPre)
        }
      }
      catch (e) {
        console.warn('[Shiki] Failed to highlight individual block:', e)
      }
    })
  }
  catch (error) {
    console.warn('[Shiki] Failed to load highlighter:', error)
  }
}
