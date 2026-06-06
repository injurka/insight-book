import type { Ref } from 'vue'
import { computed, reactive, watch } from 'vue'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useToast } from '~/shared/composables/use-toast'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { i18n } from '~/shared/plugins/i18n'

export function useBookStatsEdit(isEditingStats: Ref<boolean>) {
  const libraryStore = useLibraryStore()
  const toast = useToast()

  const editForm = reactive({
    difficulty: '',
    tags: '',
    description: '',
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

  watch(isEditingStats, (val) => {
    if (val) {
      const stats = libraryStore.currentBookInfo?.stats
      const opts = currentDifficultyOptions.value.map(o => o.value)
      const currentDiff = stats?.difficulty || ''

      editForm.difficulty = opts.includes(currentDiff) ? currentDiff : ''
      editForm.tags = stats?.tags?.join(', ') || ''
      editForm.description = stats?.description || ''
    }
  })

  async function saveStats() {
    if (!libraryStore.currentBookInfo)
      return
    try {
      const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      await libraryStore.updateBookStats(libraryStore.currentBookInfo.id, {
        difficulty: editForm.difficulty,
        tags: tagsArray,
        description: editForm.description,
      })
      isEditingStats.value = false
      toast.success(i18n.global.t('library.infoUpdated'))
    }
    catch (e) {
      toast.error(e instanceof Error ? e.message : i18n.global.t('library.updateInfoError'))
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
    currentDifficultyOptions,
    difficultyLevelClass,
    saveStats,
    triggerAiAnalysis,
    triggerVocabularyAnalysis,
  }
}
