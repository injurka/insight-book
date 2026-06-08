/// <reference types="@types/bun" />
/// <reference types="bun-types" />

import '@ai-sdk/openai'

declare module '@ai-sdk/openai' {
  interface OpenAIProviderSettings {
    /**
     * 'strict' — дефолт (проверять название модели),
     * 'compatible' — принимать любые openai-совместимые модели.
     */
    compatibility?: 'strict' | 'compatible'
  }
}

declare global {
  interface Request {
    params: Record<string, string>
  }
}

export { }
