/// <reference types="@types/bun" />
/// <reference types="bun-types" />

import '@ai-sdk/openai'

declare module 'az' {
  export const Morph: {
    // eslint-disable-next-line ts/method-signature-style
    init(callback: () => void): void
    (word: string): Array<{
      word: string
      tag: {
        POS: string
        [key: string]: string | boolean
      }
    }>
  }
}

declare module '@ai-sdk/openai' {
  interface OpenAIProviderSettings {
    /**
     * 'strict' — дефолт (проверять название модели),
     * 'compatible' — принимать любые openai-совместимые модели.
     */
    compatibility?: 'strict' | 'compatible'
  }
}
export { }
