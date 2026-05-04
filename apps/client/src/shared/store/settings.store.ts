import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useGlobalSettingsStore = defineStore('globalSettings', () => {
  const aiUrl = useLocalStorage('global-ai-url', 'https://api.aihubmix.com/v1')
  const aiKey = useLocalStorage('global-ai-key', '')
  const aiModel = useLocalStorage('global-ai-model', 'gemini-3-flash-preview')

  return { aiUrl, aiKey, aiModel }
})
