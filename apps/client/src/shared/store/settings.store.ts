import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useGlobalSettingsStore = defineStore('globalSettings', () => {
  const appLanguage = useLocalStorage<string>('global-app-language', 'ru')

  if (appLanguage.value.startsWith('"') && appLanguage.value.endsWith('"')) {
    appLanguage.value = appLanguage.value.replace(/^"|"$/g, '')
  }

  const translationPriority = useLocalStorage<'dict' | 'llm'>('global-translation-priority', 'llm')
  const ttsSpeed = useLocalStorage<number>('global-tts-speed', 1)
  const ttsVoice = useLocalStorage<string>('global-tts-voice', 'Kore')

  const readerFontSize = useLocalStorage<number>('global-reader-font-size', 1.4)
  const readerLineHeight = useLocalStorage<number>('global-reader-line-height', 1.8)
  const readerFontFamily = useLocalStorage<string>('global-reader-font-family', '\'Maple Mono CN\', \'Microsoft YaHei\', sans-serif')

  const mangaOcrDisplayMode = useLocalStorage<'hover' | 'popover'>('global-manga-ocr-mode', 'popover')

  const useCustomLlm = useLocalStorage<boolean>('global-custom-llm', false)
  const customLlmUrl = useLocalStorage<string>('global-custom-llm-url', 'http://localhost:11434/v1')
  const customLlmKey = useLocalStorage<string>('global-custom-llm-key', 'ollama')
  const customLlmModel = useLocalStorage<string>('global-custom-llm-model', 'llama3')

  const autoAnalyzePage = useLocalStorage<boolean>('global-auto-analyze-page', true)
  const autoAnalyzeSentences = useLocalStorage<boolean>('global-auto-analyze-sentences', true)
  const autoAnalyzeWords = useLocalStorage<boolean>('global-auto-analyze-words', true)
  const autoAnalyzeTtsSentences = useLocalStorage<boolean>('global-auto-analyze-tts-sentences', false)
  const autoAnalyzeTtsWords = useLocalStorage<boolean>('global-auto-analyze-tts-words', false)

  const parallelViewMode = useLocalStorage<'none' | 'split' | 'interleaved'>('global-parallel-view-mode', 'none')
  const parallelBlurTranslation = useLocalStorage<boolean>('global-parallel-blur-translation', false)

  const highlightSavedQuotes = useLocalStorage<boolean>('global-highlight-saved-quotes', true)

  return {
    appLanguage,
    autoAnalyzePage,
    autoAnalyzeSentences,
    autoAnalyzeWords,
    autoAnalyzeTtsSentences,
    autoAnalyzeTtsWords,
    parallelViewMode,
    parallelBlurTranslation,
    translationPriority,
    ttsSpeed,
    ttsVoice,
    readerFontSize,
    readerLineHeight,
    readerFontFamily,
    mangaOcrDisplayMode,
    useCustomLlm,
    customLlmUrl,
    customLlmKey,
    customLlmModel,
    highlightSavedQuotes,
  }
})
