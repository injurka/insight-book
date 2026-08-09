import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useGlobalSettingsStore = defineStore('globalSettings', () => {
  const appLanguage = useLocalStorage<string>('global-app-language', 'ru')
  const appFontFamily = useLocalStorage<string>('global-app-font-family', '\'Maple Mono CN\', monospace')
  const appFontCustom = useLocalStorage<string>('global-app-font-custom', '')

  const effectiveAppFont = computed(() => {
    if (appFontFamily.value === 'custom') {
      const clean = appFontCustom.value.trim()

      return clean ? `'${clean}', sans-serif` : 'sans-serif'
    }

    return appFontFamily.value
  })

  if (appLanguage.value.startsWith('"') && appLanguage.value.endsWith('"'))
    appLanguage.value = appLanguage.value.replace(/^"|"$/g, '')

  const ttsSpeed = useLocalStorage<number>('global-tts-speed', 1)
  const ttsVoice = useLocalStorage<string>('global-tts-voice', 'Kore')

  const readerFontSize = useLocalStorage<number>('global-reader-font-size', 1.4)
  const readerLineHeight = useLocalStorage<number>('global-reader-line-height', 1.8)
  const readerFontFamily = useLocalStorage<string>('global-reader-font-family', '\'Maple Mono CN\', \'Microsoft YaHei\', sans-serif')
  const readerBrightness = ref<number>(1.0)

  const mangaOcrDisplayMode = useLocalStorage<'hover' | 'popover'>('global-manga-ocr-mode', 'popover')

  const useCustomLlm = useLocalStorage<boolean>('global-custom-llm', false)
  const customLlmUrl = useLocalStorage<string>('global-custom-llm-url', 'http://localhost:11434/v1')
  const customLlmKey = useLocalStorage<string>('global-custom-llm-key', 'ollama')
  const customLlmModel = useLocalStorage<string>('global-custom-llm-model', 'llama3')

  const enableHoverRevealBg = useLocalStorage<boolean>('global-enable-hover-reveal-bg', true)
  const enableEruda = useLocalStorage<boolean>('global-enable-eruda', false)

  const autoAnalyzePage = useLocalStorage<boolean>('global-auto-analyze-page', false)
  const autoAnalyzeSentences = useLocalStorage<boolean>('global-auto-analyze-sentences', true)
  const autoAnalyzeWords = useLocalStorage<boolean>('global-auto-analyze-words', true)
  const autoAnalyzeTtsSentences = useLocalStorage<boolean>('global-auto-analyze-tts-sentences', false)
  const autoAnalyzeTtsWords = useLocalStorage<boolean>('global-auto-analyze-tts-words', false)

  const enabledPlugins = useLocalStorage<string[]>('global-enabled-plugins', [])

  const parallelViewMode = useLocalStorage<'none' | 'split' | 'interleaved'>('global-parallel-view-mode', 'none')
  const parallelBlurTranslation = useLocalStorage<boolean>('global-parallel-blur-translation', false)
  const parallelShowGrammar = useLocalStorage<boolean>('global-parallel-show-grammar', false)

  const highlightSavedQuotes = useLocalStorage<boolean>('global-highlight-saved-quotes', true)
  const showSentenceTtsButton = useLocalStorage<boolean>('global-show-sentence-tts-button', false)

  return {
    appLanguage,
    appFontFamily,
    appFontCustom,
    effectiveAppFont,
    autoAnalyzePage,
    autoAnalyzeSentences,
    autoAnalyzeWords,
    autoAnalyzeTtsSentences,
    autoAnalyzeTtsWords,
    parallelViewMode,
    parallelBlurTranslation,
    parallelShowGrammar,
    ttsSpeed,
    ttsVoice,
    readerFontSize,
    readerLineHeight,
    readerFontFamily,
    readerBrightness,
    mangaOcrDisplayMode,
    useCustomLlm,
    customLlmUrl,
    customLlmKey,
    customLlmModel,
    highlightSavedQuotes,
    showSentenceTtsButton,
    enableHoverRevealBg,
    enableEruda,
    enabledPlugins,
  }
})
