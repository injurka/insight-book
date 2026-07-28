import type { BundledLanguage, BundledTheme, Highlighter } from 'shiki'
import { createBirpc } from 'birpc'
import { createHighlighter } from 'shiki'

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

let highlighterPromise: Promise<Highlighter> | null = null

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: SUPPORTED_LANGS,
    })
  }
  return highlighterPromise
}

// 1. Описываем функции, которые будет выполнять воркер
const rpcFunctions = {
  async highlightCode(code: string, lang: string, theme: string): Promise<string> {
    const highlighter = await getHighlighter()
    const loadedLangs = highlighter.getLoadedLanguages()

    let finalLang = 'javascript'
    if (lang) {
      const rawLang = lang.toLowerCase()
      if (loadedLangs.includes(rawLang as BundledLanguage)) {
        finalLang = rawLang
      }
      else if (rawLang === 'js') {
        finalLang = 'javascript'
      }
      else if (rawLang === 'ts') {
        finalLang = 'typescript'
      }
      else if (rawLang === 'py') {
        finalLang = 'python'
      }
    }

    return highlighter.codeToHtml(code, {
      lang: finalLang,
      theme: theme as BundledTheme,
    })
  },
}

// 2. Экспортируем ТИП (не сам объект!) для использования в основном потоке
export type ShikiRpcFunctions = typeof rpcFunctions

// 3. Инициализируем двунаправленный RPC
createBirpc(rpcFunctions, {
  post: data => globalThis.postMessage(data),
  on: data => globalThis.addEventListener('message', data),
})
