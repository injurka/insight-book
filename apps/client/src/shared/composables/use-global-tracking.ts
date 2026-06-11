import { onMounted, watch } from 'vue'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useUmami } from './use-umami'

export function useGlobalTracking() {
  const settingsStore = useGlobalSettingsStore()
  const { trackEvent } = useUmami()

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

  onMounted(() => {
    window.addEventListener('appinstalled', () => {
      trackEvent('pwa_installed')
    })
  })
}
