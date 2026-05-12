import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useGlobalSettingsStore = defineStore('globalSettings', () => {
  const translationPriority = useLocalStorage<'dict' | 'llm'>('global-translation-priority', 'dict')
  const ttsSpeed = useLocalStorage<number>('global-tts-speed', 1)

  const readerFontSize = useLocalStorage<number>('global-reader-font-size', 1.4)
  const readerLineHeight = useLocalStorage<number>('global-reader-line-height', 1.8)
  const readerFontFamily = useLocalStorage<string>('global-reader-font-family', '\'Maple Mono CN\', \'Microsoft YaHei\', sans-serif')

  return {
    translationPriority,
    ttsSpeed,
    readerFontSize,
    readerLineHeight,
    readerFontFamily,
  }
})
