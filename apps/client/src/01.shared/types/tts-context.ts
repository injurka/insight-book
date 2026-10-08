import type { InjectionKey } from 'vue'

export interface TtsBookContext {
  id: number
  language: string
}

export const TTS_BOOK_CONTEXT_KEY: InjectionKey<() => TtsBookContext | null | undefined> = Symbol('TtsBookContext')
