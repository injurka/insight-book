import type { Ref } from 'vue'
import { computed, reactive, ref, watch } from 'vue'
import { i18n } from '~/00.plugins/i18n'
import { useToast } from '~/01.shared/composables/use-toast'
import { DIFFICULTY_SYSTEMS } from '~/01.shared/constants/difficulties'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { useLibraryStore } from '~/05.modules/library/store/library.store'

const DESCRIPTION_LANGS = ['ru', 'en', 'zh'] as const
type DescLang = typeof DESCRIPTION_LANGS[number]

function parseDescriptionJson(raw: string | undefined): Record<DescLang, string> {
  const result: Record<DescLang, string> = { ru: '', en: '', zh: '' }
  if (!raw)
    return result
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      for (const lang of DESCRIPTION_LANGS)
        result[lang] = parsed[lang] || ''
    }
    else {
      // Plain string — put into all langs
      result.ru = raw
    }
  }
  catch {
    result.ru = raw
  }

  return result
}

function serializeDescriptionJson(byLang: Record<DescLang, string>): string {
  const nonEmpty = DESCRIPTION_LANGS.some(l => byLang[l].trim())
  if (!nonEmpty)
    return ''

  return JSON.stringify({ ru: byLang.ru, en: byLang.en, zh: byLang.zh })
}

export function useBookStatsEdit(isEditingStats: Ref<boolean>) {
  const libraryStore = useLibraryStore()
  const settingsStore = useGlobalSettingsStore()
  const toast = useToast()

  const interfaceDescriptionLang = computed<DescLang>(() => (DESCRIPTION_LANGS as readonly string[]).includes(settingsStore.appLanguage)
    ? settingsStore.appLanguage as DescLang
    : 'ru')

  const editDescLang = ref<DescLang>(interfaceDescriptionLang.value)

  const isSaving = ref(false)
  const initialForm = ref('')
  const editForm = reactive({
    difficulty: '',
    tags: '',
    descriptionByLang: { ru: '', en: '', zh: '' },
  })

  const currentDifficultyOptions = computed(() => {
    const lang = libraryStore.currentBookInfo?.language || 'en'
    const system = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.default

    return [
      { label: i18n.global.t('dictionary.noDifficulty'), value: '' },
      ...system.map(opt => ({ label: opt.label, value: opt.value })),
    ]
  })

  const difficultyLevelClass = computed(() => {
    const diffValue = libraryStore.currentBookInfo?.stats?.difficulty
    if (!diffValue)
      return ''

    const lang = libraryStore.currentBookInfo?.language || 'en'
    const system = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.default
    const found = system.find(s => s.value === diffValue)

    if (!found)
      return ''

    if (found.level <= 2)
      return 'level-easy'
    if (found.level <= 4)
      return 'level-medium'

    return 'level-hard'
  })

  const currentDescription = computed(() => {
    const raw = libraryStore.currentBookInfo?.stats?.description
    if (!raw)
      return i18n.global.t('bookStats.noDescription')
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed[settingsStore.appLanguage as DescLang]
          || DESCRIPTION_LANGS.map(lang => parsed[lang]).find(value => typeof value === 'string' && value.trim())
          || i18n.global.t('bookStats.noDescription')
      }
    }
    catch { /* plain string */ }

    return raw
  })

  watch(isEditingStats, (val) => {
    if (val) {
      const stats = libraryStore.currentBookInfo?.stats
      const opts = currentDifficultyOptions.value.map(o => o.value)
      const currentDiff = stats?.difficulty || ''

      editForm.difficulty = opts.includes(currentDiff) ? currentDiff : ''
      editForm.tags = stats?.tags?.join(', ') || ''
      editForm.descriptionByLang = parseDescriptionJson(stats?.description)
      // Start editing in the current interface language.
      editDescLang.value = interfaceDescriptionLang.value
      initialForm.value = JSON.stringify(editForm)
    }
  })

  const isDirty = computed(() => JSON.stringify(editForm) !== initialForm.value)

  async function saveStats() {
    if (!libraryStore.currentBookInfo || isSaving.value)
      return
    isSaving.value = true
    try {
      const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      const description = serializeDescriptionJson(editForm.descriptionByLang)
      await libraryStore.updateBookStats(libraryStore.currentBookInfo.id, {
        difficulty: editForm.difficulty,
        tags: tagsArray,
        description,
      })
      isEditingStats.value = false
      toast.success(i18n.global.t('library.infoUpdated'))
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : i18n.global.t('library.updateInfoError'))
    }
    finally {
      isSaving.value = false
    }
  }

  async function triggerAiAnalysis() {
    if (!libraryStore.currentBookInfo)
      return
    try {
      await libraryStore.analyzeFullBook(libraryStore.currentBookInfo.id)
      isEditingStats.value = false
      toast.success(i18n.global.t('library.aiAnalysisSuccess'))
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : i18n.global.t('library.aiAnalysisError'))
    }
  }

  async function triggerVocabularyAnalysis() {
    if (!libraryStore.currentBookInfo)
      return
    try {
      await libraryStore.analyzeVocabulary(libraryStore.currentBookInfo.id)
      isEditingStats.value = false
      toast.success(i18n.global.t('library.vocabProfileSuccess'))
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : i18n.global.t('library.vocabAnalysisError'))
    }
  }

  return {
    editForm,
    isSaving,
    isDirty,
    editDescLang,
    currentDescription,
    currentDifficultyOptions,
    difficultyLevelClass,
    saveStats,
    triggerAiAnalysis,
    triggerVocabularyAnalysis,
    DESCRIPTION_LANGS,
  }
}
