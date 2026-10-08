import { onMounted, onUnmounted, watch } from 'vue'
import { themePreference } from '~/01.shared/composables/use-change-theme'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useTracking } from './use-tracking'

export function useGlobalTracking() {
  const settingsStore = useGlobalSettingsStore()
  const { trackEvent } = useTracking()

  watch(() => settingsStore.useCustomLlm, (val) => {
    trackEvent('custom_llm_enabled', { enabled: val })
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

  watch(themePreference, (val) => {
    trackEvent('theme_changed', { theme: val })
  })

  watch(() => settingsStore.appLanguage, (val) => {
    trackEvent('app_language_changed', { language: val })
  })

  const onAppInstalled = () => trackEvent('pwa_installed')

  onMounted(() => window.addEventListener('appinstalled', onAppInstalled))
  onUnmounted(() => window.removeEventListener('appinstalled', onAppInstalled))
}
