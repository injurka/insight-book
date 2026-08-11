/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_FARO_URL?: string
  readonly VITE_CDN_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'highlight.js' {
  export interface LanguageFn {
    (hljs: any): any
  }
  export interface HLJSApi {
    highlight(code: string, options: { language: string, ignoreIllegals?: boolean }): { value: string, language?: string }
    highlightAuto(code: string, languageSubset?: string[]): { value: string, language?: string }
    registerLanguage(languageName: string, languageDefinition: LanguageFn): void
  }
  const hljs: HLJSApi
  export default hljs
}

declare module 'highlight.js/lib/core' {
  import hljs from 'highlight.js'

  export default hljs
}


declare module 'highlight.js/lib/languages/*' {
  import type { LanguageFn } from 'highlight.js'

  const language: LanguageFn
  export default language
}


