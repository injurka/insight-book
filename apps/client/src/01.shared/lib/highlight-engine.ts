/**
 * Lazy-loaded highlight.js engine.
 * Only loads when code blocks are actually encountered in book content.
 * Total bundle: ~30KB gzipped (vs shiki's 10MB).
 */
import type { LanguageFn } from 'highlight.js'

interface HighlightResult {
  value: string
  language?: string
}

export class HighlightEngine {
  private hljs: typeof import('highlight.js/lib/core').default | null = null
  private registered = new Set<string>()

  static async create(): Promise<HighlightEngine> {
    const engine = new HighlightEngine()
    await engine.init()

    return engine
  }

  private async init(): Promise<void> {
    // Theme CSS — loaded once alongside the engine
    await import('highlight.js/styles/github.css')
    const { default: hljs } = await import('highlight.js/lib/core')

    // Register only the languages we support (was 17 in shiki)
    const langMap: Record<string, () => Promise<{ default: LanguageFn }>> = {
      javascript: () => import('highlight.js/lib/languages/javascript'),
      typescript: () => import('highlight.js/lib/languages/typescript'),
      python: () => import('highlight.js/lib/languages/python'),
      xml: () => import('highlight.js/lib/languages/xml'), // covers HTML too
      css: () => import('highlight.js/lib/languages/css'),
      json: () => import('highlight.js/lib/languages/json'),
      bash: () => import('highlight.js/lib/languages/bash'),
      sql: () => import('highlight.js/lib/languages/sql'),
      c: () => import('highlight.js/lib/languages/c'),
      cpp: () => import('highlight.js/lib/languages/cpp'),
      csharp: () => import('highlight.js/lib/languages/csharp'),
      java: () => import('highlight.js/lib/languages/java'),
      go: () => import('highlight.js/lib/languages/go'),
      rust: () => import('highlight.js/lib/languages/rust'),
      yaml: () => import('highlight.js/lib/languages/yaml'),
      markdown: () => import('highlight.js/lib/languages/markdown'),
    }

    // Pre-register all languages so they're available immediately
    const entries = await Promise.all(Object.entries(langMap).map(async ([name, loader]) => {
      const mod = await loader()

      return [name, mod.default] as const
    }))

    for (const [name, fn] of entries) {
      hljs.registerLanguage(name, fn)
      this.registered.add(name)
    }

    this.hljs = hljs
  }

  highlight(code: string, lang?: string): HighlightResult | null {
    if (!this.hljs)
      return null

    const normalized = this.normalizeLang(lang)

    try {
      if (normalized && this.registered.has(normalized)) {
        const result = this.hljs.highlight(code, { language: normalized, ignoreIllegals: true })

        return { value: result.value, language: normalized }
      }

      // Auto-detect language
      const result = this.hljs.highlightAuto(code, Array.from(this.registered))

      return { value: result.value, language: result.language }
    }
    catch {
      // Fallback: escape HTML and wrap
      const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

      return { value: escaped, language: normalized }
    }
  }

  private normalizeLang(lang?: string): string | undefined {
    if (!lang)
      return undefined
    const raw = lang.toLowerCase()
    const aliases: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'html': 'xml',
      'c++': 'cpp',
      'cs': 'csharp',
      'golang': 'go',
      'rs': 'rust',
      'yml': 'yaml',
      'md': 'markdown',
      'sh': 'bash',
      'shell': 'bash',
    }

    return aliases[raw] || raw
  }
}
