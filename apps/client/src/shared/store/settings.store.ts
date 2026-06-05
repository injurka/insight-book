import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useGlobalSettingsStore = defineStore('globalSettings', () => {
  const translationPriority = useLocalStorage<'dict' | 'llm'>('global-translation-priority', 'dict')
  const ttsSpeed = useLocalStorage<number>('global-tts-speed', 1)

  const readerFontSize = useLocalStorage<number>('global-reader-font-size', 1.4)
  const readerLineHeight = useLocalStorage<number>('global-reader-line-height', 1.8)
  const readerFontFamily = useLocalStorage<string>('global-reader-font-family', '\'Maple Mono CN\', \'Microsoft YaHei\', sans-serif')

  const mangaOcrDisplayMode = useLocalStorage<'hover' | 'popover'>('global-manga-ocr-mode', 'hover')

  const useCustomLlm = useLocalStorage<boolean>('global-custom-llm', false)
  const customLlmUrl = useLocalStorage<string>('global-custom-llm-url', 'http://localhost:11434/v1')
  const customLlmKey = useLocalStorage<string>('global-custom-llm-key', 'ollama')
  const customLlmModel = useLocalStorage<string>('global-custom-llm-model', 'llama3')

  return {
    translationPriority,
    ttsSpeed,
    readerFontSize,
    readerLineHeight,
    readerFontFamily,
    mangaOcrDisplayMode, // <--- Экспортируем
    useCustomLlm,
    customLlmUrl,
    customLlmKey,
    customLlmModel,
  }
})
