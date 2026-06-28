import type { SelectOption } from '~/shared/types/models'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { useDictionaryStore } from '../store/dictionary.store'

export function useDictFilterOptions() {
  const store = useDictionaryStore()
  const { t } = useI18n()

  const langOptions = computed(() => {
    const opts = [{ label: t('dictionary.allLanguages'), value: 'all' }]
    store.availableLanguages.forEach((l) => {
      const key = `library.lang${l.charAt(0).toUpperCase() + l.slice(1)}`
      const translated = t(key)
      opts.push({ label: translated !== key ? translated : l.toUpperCase(), value: l })
    })
    return opts
  })

  const deckOptions = computed(() => {
    const opts: SelectOption[] = [
      { label: t('dictionary.allDecks'), value: 'all' },
      { label: t('dictionary.noDeck'), value: 'none' },
    ]
    store.decks.forEach((d) => {
      if (store.selectedLanguage === 'all' || d.language === store.selectedLanguage) {
        opts.push({ label: d.name, value: d.id })
      }
    })
    return opts
  })

  const difficultyOptions = computed(() => {
    const opts: SelectOption[] = [
      { label: t('dictionary.allDifficulties'), value: 'all' },
      { label: t('dictionary.noDifficulty'), value: 'none' },
    ]
    const lang = store.selectedLanguage !== 'all' ? store.selectedLanguage : 'all'
    const sys = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.all
    sys.forEach(d => opts.push({ label: d.label, value: d.value }))
    return opts
  })

  const statusOptions = computed(() => [
    { label: t('dictionary.allStatuses'), value: 'all' },
    { label: t('dictionary.statusNew'), value: '0' },
    { label: t('dictionary.statusLearning'), value: '1' },
    { label: t('dictionary.statusReview'), value: '2' },
    { label: t('dictionary.statusRelearning'), value: '3' },
  ])

  const newDeckLangOptions = computed(() => {
    const langs = new Set(['en', 'zh', 'ja', 'ru', ...store.availableLanguages])
    return Array.from(langs).map((l) => {
      const key = `library.lang${l.charAt(0).toUpperCase() + l.slice(1)}`
      const translated = t(key)
      return { label: translated !== key ? translated : l.toUpperCase(), value: l }
    })
  })

  return {
    langOptions,
    deckOptions,
    difficultyOptions,
    statusOptions,
    newDeckLangOptions,
  }
}
