import { useStorage } from '@vueuse/core'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

export type LocaleType = 'ru' | 'en' | 'cn'

export function useLocale() {
  const { locale, t } = useI18n()

  const currentLocale = useStorage<LocaleType>('app-locale', 'ru')

  watch(currentLocale, (newLocale) => {
    locale.value = newLocale
  }, { immediate: true })

  const cycleLanguage = () => {
    const langs: LocaleType[] = ['ru', 'en', 'cn']
    const nextIndex = (langs.indexOf(currentLocale.value) + 1) % langs.length
    currentLocale.value = langs[nextIndex]
  }

  const languageNames: Record<LocaleType, string> = {
    ru: 'Русский',
    en: 'English',
    cn: '中文',
  }

  return {
    currentLocale,
    cycleLanguage,
    languageNames,
    t,
  }
}
