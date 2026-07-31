import { onMounted, watch } from 'vue'
import { useChangeTheme } from '~/01.shared/composables/use-change-theme'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useUmami } from './use-umami'

export function useGlobalTracking() {
  const settingsStore = useGlobalSettingsStore()
  const { theme } = useChangeTheme()
  const { trackEvent, identifyUser } = useUmami()

  watch(() => settingsStore.useCustomLlm, (val) => {
    trackEvent('custom_llm_enabled', { enabled: val })
  })

  watch(() => settingsStore.translationPriority, (val) => {
    trackEvent('translation_priority_changed', { priority: val })
  })

  watch(() => settingsStore.ttsSpeed, (val) => {
    trackEvent('tts_speed_changed', { speed: val })
  })

  watch(() => settingsStore.readerFontSize, (val) => {
    trackEvent('reader_font_size_changed', { size: val })
  })

  watch(() => settingsStore.readerFontFamily, (val) => {
    trackEvent('reader_font_family_changed', { font: val })
  })

  watch(() => settingsStore.mangaOcrDisplayMode, (val) => {
    trackEvent('manga_ocr_mode_changed', { mode: val })
  })

  watch(theme, (val) => {
    trackEvent('theme_changed', { theme: val })
    identifyUser({ current_theme: val } as any)
  })

  watch(() => settingsStore.appLanguage, (val) => {
    trackEvent('app_language_changed', { language: val })
    identifyUser({ current_language: val } as any)
  })

  onMounted(() => {
    window.addEventListener('appinstalled', () => {
      trackEvent('pwa_installed')
    })
  })
}
