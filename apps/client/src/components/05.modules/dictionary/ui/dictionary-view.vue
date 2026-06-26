<script setup lang="ts">
import type { SelectOption, UserDictItem } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { useVirtualList } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitDialog, KitDropdown, KitInput, KitPrompt, KitSelect, KitTooltip } from '~/components/01.kit'
import KitSkeleton from '~/components/01.kit/kit-skeleton/ui/kit-skeleton.vue'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { GlobalActions } from '~/components/04.features/global-actions'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { api } from '~/shared/services/api.service'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useAuthStore } from '~/shared/store/auth.store'
import { useDictionaryStore } from '../store/dictionary.store'

const ActivityHeatmap = lazyComponent(() => import('~/components/02.shared/activity-heatmap/ui/activity-heatmap.vue'))
const DictWordDetailsModal = lazyComponent(() => import('~/components/03.domain/dict-word/ui/dict-word-details-modal.vue'))
const DictionaryDiscoverDialog = lazyComponent(() => import('./dialog/dictionary-discover-dialog.vue'))
const SrsTrainingDialog = lazyComponent(() => import('./dialog/srs-training-dialog.vue'))

const store = useDictionaryStore()
const analysisStore = useAnalysisStore()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const { t } = useI18n()
const { trackEvent } = useUmami()

const isTrainingOpen = ref(false)
const isMobileFiltersOpen = ref(false)
const dropdownRef = ref<InstanceType<typeof KitDropdown> | null>(null)
const isStatsModalOpen = ref(false)
const isEditMode = ref(false)

const isDetailsModalOpen = ref(false)
const selectedWordDetails = ref<UserDictItem | null>(null)

const isManageDecksOpen = ref(false)
const isDiscoverOpen = ref(false)
const newDeckName = ref('')
const newDeckLang = ref('en')

const isRenamePromptOpen = ref(false)
const isDeleteConfirmOpen = ref(false)
const renameDeckTarget = ref<{ id: number, name: string } | null>(null)
const deleteDeckTarget = ref<{ id: number, name: string } | null>(null)

const isBulkMoveOpen = ref(false)

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
  const opts: SelectOption[] = [{ label: t('dictionary.allDifficulties'), value: 'all' }, { label: t('dictionary.noDifficulty'), value: 'none' }]
  const lang = store.selectedLanguage !== 'all' ? store.selectedLanguage : 'all'
  const sys = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.all
  sys.forEach(d => opts.push({ label: d.label, value: d.value }))
  return opts
})

watch(() => store.selectedLanguage, () => {
  store.selectedDeckId = ['all']
  store.selectedDifficulty = ['all']
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

const { list, containerProps, wrapperProps } = useVirtualList(
  computed(() => store.filteredWords),
  { itemHeight: 110 },
)

onMounted(() => {
  store.fetchDictionary()
  fetchActivity()
})

function getStatusLabel(state: number) {
  switch (state) {
    case 0: return { label: t('dictionary.statusNew'), color: 'var(--fg-info-color)' }
    case 1: return { label: t('dictionary.statusLearning'), color: 'var(--fg-warning-color)' }
    case 2: return { label: t('dictionary.statusReview'), color: 'var(--fg-success-color)' }
    case 3: return { label: t('dictionary.statusRelearning'), color: 'var(--fg-error-color)' }
    default: return { label: t('dictionary.statusUnknown'), color: 'var(--fg-muted-color)' }
  }
}

function getDifficultyClass(lang: string, diffValue: string | null) {
  if (!diffValue)
    return ''
  const system = DIFFICULTY_SYSTEMS[lang] || DIFFICULTY_SYSTEMS.default
  const found = system.find(s => s.value === diffValue)

  if (!found)
    return ''
  if (found.level <= 2)
    return 'level-easy'
  if (found.level <= 4)
    return 'level-medium'
  return 'level-hard'
}

function openTrainingSettings(mode: 'srs' | 'random' | 'deep_dive') {
  store.trainingMode = mode
  isTrainingOpen.value = true
  dropdownRef.value?.close()
}

async function createNewDeck() {
  if (newDeckName.value.trim()) {
    await store.createDeck(newDeckName.value.trim(), newDeckLang.value)
    newDeckName.value = ''
  }
}

function openRenameDeck(id: number, currentName: string) {
  renameDeckTarget.value = { id, name: currentName }
  isRenamePromptOpen.value = true
}

async function onRenameDeckSubmit(newName: string) {
  if (renameDeckTarget.value && newName.trim() && newName !== renameDeckTarget.value.name) {
    await store.updateDeck(renameDeckTarget.value.id, newName.trim())
  }
  renameDeckTarget.value = null
}

function openDeleteDeck(id: number, name: string) {
  deleteDeckTarget.value = { id, name }
  isDeleteConfirmOpen.value = true
}

async function onDeleteDeckConfirm() {
  if (deleteDeckTarget.value) {
    await store.deleteDeck(deleteDeckTarget.value.id)
  }
  deleteDeckTarget.value = null
}

function openDetails(item: UserDictItem) {
  if (isEditMode.value) {
    store.toggleWordSelection(item.id)
    return
  }
  selectedWordDetails.value = item
  isDetailsModalOpen.value = true
}

function exportToAnki() {
  const wordsToExport = store.words.filter(w => store.selectedWordIds.has(w.id))
  if (!wordsToExport.length)
    return

  const rows = wordsToExport.map((w) => {
    const translation = (w.translation || '').replace(/\n/g, '<br>')
    const notes = (w.notes || '').replace(/\n/g, '<br>')
    return `${w.word}\t${w.transcription || ''}\t${translation}\t${notes}`
  })

  const content = rows.join('\n')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `insight_anki_export_${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)

  store.clearSelection()
  toast.success(t('dictionary.ankiExported'))
  trackEvent('anki_export_downloaded')
}

const activityData = ref<{ date: string, count: number }[]>([])
const activityStats = ref({ learnedWords: 0, readPages: 0, difficulties: [] as any[] })
const isActivityLoading = ref(true)

async function fetchActivity() {
  if (authStore.user) {
    isActivityLoading.value = true
    try {
      const res = await api.activity.getStats()
      activityData.value = res.heatmap
      activityStats.value = {
        learnedWords: res.learnedWords,
        readPages: res.readPages,
        difficulties: res.difficulties,
      }
    }
    catch (e) {
      console.error('Failed to load activity data:', e)
    }
    finally {
      isActivityLoading.value = false
    }
  }
  else {
    isActivityLoading.value = false
  }
}

watch(isTrainingOpen, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    store.fetchTrainingQueue({ mode: 'srs', deckId: 'all', difficulty: ['all'] })
    fetchActivity()
  }
})

watch(isEditMode, (val) => {
  if (!val) {
    store.clearSelection()
  }
})
</script>

<template>
  <div class="dictionary-page">
    <HoverRevealBg />

    <header class="dict-header">
      <div class="header-top">
        <div class="title-group">
          <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
          <h1>{{ t('dictionary.title') }}</h1>
        </div>
        <GlobalActions hide-dictionary />
      </div>

      <div class="header-bottom">
        <div class="search-wrapper">
          <KitInput
            v-model="store.searchTerm"
            :placeholder="t('dictionary.searchPlaceholder')"
            class="search-input"
          />
          <div class="mobile-controls">
            <KitBtn
              :icon="isMobileFiltersOpen ? 'mdi:chevron-up' : 'mdi:tune-variant'"
              variant="tonal"
              color="secondary"
              @click="isMobileFiltersOpen = !isMobileFiltersOpen"
            />
          </div>
        </div>

        <div class="extra-filters" :class="{ 'is-open': isMobileFiltersOpen }">
          <KitSelect
            v-model="store.selectedLanguage"
            :options="langOptions"
            class="filter-select"
          />
          <KitSelect
            v-model="store.selectedDeckId"
            :options="deckOptions"
            class="filter-select"
            multiple
          />
          <KitSelect
            v-model="store.selectedDifficulty"
            :options="difficultyOptions"
            class="filter-select"
            multiple
          />
          <KitSelect
            v-model="store.selectedStatus"
            :options="statusOptions"
            class="filter-select"
            multiple
          />
        </div>

        <div class="actions-and-stats">
          <div class="main-actions">
            <KitDropdown ref="dropdownRef" placement="bottom-end" width="260px" class="training-dropdown">
              <template #activator="{ props }">
                <KitBtn
                  icon="mdi:brain"
                  :color="store.totalReviewCount > 0 ? 'primary' : 'accent'"
                  :variant="store.totalReviewCount > 0 ? 'solid' : 'outlined'"
                  :class="{ 'is-active-btn': props.isOpen }"
                  class="full-width-btn"
                >
                  {{ t('dictionary.training') }} <Icon icon="mdi:chevron-down" class="ml-1" />
                </KitBtn>
              </template>
              <div class="dropdown-menu-list">
                <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('srs')">
                  <Icon icon="mdi:calendar-clock" />
                  {{ t('dictionary.srsTraining') }}
                </button>
                <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('random')">
                  <Icon icon="mdi:shuffle-variant" />
                  {{ t('dictionary.randomTraining') }}
                </button>
                <button class="dropdown-item" :disabled="store.words.length === 0" @click="openTrainingSettings('deep_dive')">
                  <Icon icon="mdi:diving-scuba" />
                  {{ t('dictionary.deepDiveTraining') }}
                </button>
              </div>
            </KitDropdown>

            <KitTooltip text="Discover & Import" placement="bottom">
              <KitBtn icon="mdi:bookshelf" variant="tonal" color="primary" @click="isDiscoverOpen = true" />
            </KitTooltip>

            <KitTooltip :text="t('dictionary.manageDecks')" placement="bottom">
              <KitBtn icon="mdi:folder-cog-outline" variant="tonal" color="secondary" @click="isManageDecksOpen = true" />
            </KitTooltip>
          </div>

          <div class="stats-badge">
            <span class="badge">{{ t('dictionary.wordsCount', { count: store.filteredWords.length }) }}</span>
            <div class="badge-actions">
              <KitTooltip :text="isEditMode ? t('dictionary.done') : t('dictionary.edit')" placement="bottom-end">
                <KitBtn
                  :icon="isEditMode ? 'mdi:check' : 'mdi:pencil-outline'"
                  variant="text"
                  :color="isEditMode ? 'primary' : 'secondary'"
                  @click="isEditMode = !isEditMode"
                />
              </KitTooltip>
              <KitTooltip :text="t('dictionary.stats')" placement="bottom-end">
                <KitBtn
                  icon="mdi:chart-box-outline"
                  variant="text"
                  color="secondary"
                  @click="isStatsModalOpen = true"
                />
              </KitTooltip>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="dict-layout">
      <div class="words-content">
        <Transition name="fade">
          <div v-if="store.selectedWordIds.size > 0 && isEditMode" class="bulk-action-bar">
            <span class="selected-count">{{ t('dictionary.selectedCount', { count: store.selectedWordIds.size }) }}</span>
            <div class="actions">
              <KitBtn size="sm" variant="text" @click="store.selectAllFiltered()">
                {{ t('dictionary.selectAll') }}
              </KitBtn>
              <KitBtn size="sm" variant="text" @click="store.clearSelection()">
                {{ t('dictionary.resetSelection') }}
              </KitBtn>
              <div class="divider" />
              <KitTooltip :text="t('dictionary.exportAnkiHint')" placement="top">
                <KitBtn size="sm" color="primary" variant="tonal" icon="mdi:export-variant" @click="exportToAnki">
                  {{ t('dictionary.exportAnki') }}
                </KitBtn>
              </KitTooltip>
              <KitBtn size="sm" color="primary" variant="tonal" icon="mdi:folder-move-outline" @click="isBulkMoveOpen = true">
                {{ t('dictionary.move') }}
              </KitBtn>
              <KitBtn size="sm" color="error" variant="tonal" icon="mdi:delete-outline" @click="store.bulkDelete()">
                {{ t('dictionary.delete') }}
              </KitBtn>
            </div>
          </div>
        </Transition>

        <div v-if="!store.words.length && !store.isLoading" class="empty-state">
          <p>{{ t('dictionary.emptyState') }}</p>
        </div>

        <div v-else-if="!store.filteredWords.length && !store.isLoading" class="empty-state">
          <p>{{ t('dictionary.emptySearch') }}</p>
          <p class="empty-hint">
            {{ t('dictionary.emptySearchHint') }}
          </p>
        </div>

        <div v-else class="virtual-list-container" v-bind="containerProps">
          <div v-bind="wrapperProps" class="virtual-list-wrapper">
            <div v-for="item in list" :key="item.data.id" class="dict-item" :class="{ 'is-selected': store.selectedWordIds.has(item.data.id) }" @click="openDetails(item.data)">
              <div v-if="isEditMode" class="checkbox-col" @click.stop>
                <KitCheckbox :model-value="store.selectedWordIds.has(item.data.id)" @update:model-value="store.toggleWordSelection(item.data.id)" />
              </div>
              <div class="dict-item-content">
                <div class="dict-word-container">
                  <span class="dict-word">
                    {{ item.data.word }}
                  </span>
                  <span class="dict-transcription">{{ item.data.transcription }}</span>
                  <span
                    v-if="item.data.difficulty"
                    class="diff-badge"
                    :class="getDifficultyClass(item.data.language, item.data.difficulty)"
                  >
                    {{ item.data.difficulty }}
                  </span>
                  <span class="srs-badge" :style="{ color: getStatusLabel(item.data.state).color }">
                    {{ getStatusLabel(item.data.state).label }}
                  </span>
                </div>
                <div class="dict-translation" v-html="item.data.translation" />
              </div>
              <div v-if="isEditMode" class="dict-actions" @click.stop>
                <KitTooltip :text="t('dictionary.editItem')" placement="top">
                  <KitBtn icon="mdi:pencil" variant="text" size="xs" @click="analysisStore.wordToEdit = item.data; analysisStore.addEditWordModalOpen = true;" />
                </KitTooltip>
                <KitTooltip :text="t('dictionary.deleteItem')" placement="top-end">
                  <KitBtn icon="mdi:delete-outline" variant="text" size="xs" color="error" @click="store.deleteWord(item.data.word)" />
                </KitTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Управление колодами -->
    <KitDialog v-model:visible="isManageDecksOpen" :title="t('dictionary.manageDecks')" :max-width="500">
      <div class="manage-decks-content">
        <div class="create-deck-row">
          <KitInput v-model="newDeckName" :placeholder="t('dictionary.newDeckName')" @keyup.enter="createNewDeck" />
          <KitSelect v-model="newDeckLang" :options="newDeckLangOptions" class="new-deck-lang" />
          <KitBtn color="primary" icon="mdi:plus" @click="createNewDeck" />
        </div>

        <div v-if="store.decks.length === 0" class="empty-state">
          <p>{{ t('dictionary.noDecks') }}</p>
        </div>
        <ul v-else class="decks-manage-list">
          <li v-for="deck in store.decks" :key="deck.id" class="deck-manage-item">
            <div class="deck-info">
              <Icon icon="mdi:folder-outline" />
              <span class="deck-name">{{ deck.name }}</span>
              <span class="deck-lang">{{ deck.language.toUpperCase() }}</span>
            </div>
            <div class="deck-actions">
              <KitBtn icon="mdi:pencil" size="xs" variant="text" @click="openRenameDeck(deck.id, deck.name)" />
              <KitBtn icon="mdi:delete-outline" size="xs" variant="text" color="error" @click="openDeleteDeck(deck.id, deck.name)" />
            </div>
          </li>
        </ul>
      </div>
    </KitDialog>

    <KitDialog v-model:visible="isBulkMoveOpen" :title="t('dictionary.moveToDeck')" :max-width="400">
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <KitBtn variant="outlined" style="width: 100%" @click="store.bulkMoveToDeck(null); isBulkMoveOpen = false">
          {{ t('dictionary.noDeckGeneral') }}
        </KitBtn>
        <KitBtn v-for="deck in store.decks" :key="deck.id" variant="tonal" style="width: 100%" @click="store.bulkMoveToDeck(deck.id); isBulkMoveOpen = false">
          <Icon icon="mdi:folder-outline" class="mr-2" /> {{ deck.name }}
        </KitBtn>
      </div>
    </KitDialog>

    <SrsTrainingDialog v-model:visible="isTrainingOpen" />
    <DictionaryDiscoverDialog v-model:visible="isDiscoverOpen" />
    <DictWordDetailsModal v-model:visible="isDetailsModalOpen" :word="selectedWordDetails" />

    <KitPrompt
      v-model:visible="isRenamePromptOpen"
      :title="t('dictionary.renameDeck')"
      :placeholder="t('dictionary.newDeckName')"
      :default-value="renameDeckTarget?.name"
      :confirm-text="t('dictionary.save')"
      @submit="onRenameDeckSubmit"
    />

    <KitPrompt
      v-model:visible="isDeleteConfirmOpen"
      :title="t('dictionary.deleteDeckTitle')"
      :description="t('dictionary.deleteDeckDesc', { name: deleteDeckTarget?.name || '' })"
      :hide-input="true"
      :confirm-text="t('dictionary.deleteItem')"
      :cancel-text="t('dictionary.cancel')"
      @submit="onDeleteDeckConfirm"
    />

    <KitDialog
      v-if="authStore.user"
      v-model:visible="isStatsModalOpen"
      :title="t('dictionary.activityStats')"
      icon="mdi:chart-box-outline"
      :max-width="850"
    >
      <div class="stats-modal-content">
        <KitSkeleton v-if="isActivityLoading" width="100%" height="250px" />
        <ActivityHeatmap v-else :activity-data="activityData" :stats="activityStats" />
      </div>
    </KitDialog>
  </div>
</template>

<style lang="scss" scoped>
.dictionary-page {
  position: relative;
  z-index: 1;
  padding: 16px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  flex-direction: column;

  @include media-down(md) {
    padding: 8px;
  }
}
.dict-header {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
  flex-shrink: 0;

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    .title-group {
      display: flex;
      align-items: center;
      gap: 12px;
      h1 {
        margin: 0;
        font-size: 1.5rem;
      }
    }
  }

  .header-bottom {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;

    .search-wrapper {
      flex-grow: 1;
      min-width: 250px;
      display: flex;
      gap: 8px;

      .search-input {
        width: 100%;
      }

      .mobile-controls {
        display: none;
      }
    }

    .extra-filters {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;

      .filter-select {
        width: 170px;
        flex-shrink: 0;
      }
    }

    .actions-and-stats {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-left: auto;
      width: 100%;
      justify-content: space-between;

      .main-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .ml-1 {
        margin-left: 4px;
      }

      .stats-badge {
        display: flex;
        align-items: center;
        gap: 8px;

        .badge {
          background: var(--bg-tertiary-color);
          padding: 8px 12px;
          border-radius: 99px;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--fg-secondary-color);
          white-space: nowrap;
          display: inline-block;
        }

        .badge-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
        }
      }
    }

    @include media-down(md) {
      flex-direction: column;
      align-items: stretch;

      .search-wrapper {
        min-width: 100%;
        .mobile-controls {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
      }

      .extra-filters {
        display: none;
        flex-direction: column;
        background-color: var(--bg-secondary-color);
        padding: 16px;
        border-radius: 12px;
        border: 1px solid var(--border-secondary-color);
        gap: 12px;

        &.is-open {
          display: flex;
          animation: slideDown 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .filter-select {
          width: 100%;
        }
      }

      .actions-and-stats {
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        width: 100%;
        margin-left: 0;
        gap: 12px;

        .main-actions {
          width: 100%;
          display: flex;
          .training-dropdown {
            flex: 1;
            :deep(.kit-select-trigger),
            .full-width-btn {
              width: 100%;
              justify-content: center;
            }
          }
        }

        .stats-badge {
          width: 100%;
        }
      }
    }
  }
}

.dict-layout {
  display: flex;
  flex-grow: 1;
  gap: 20px;
  min-height: 0;
}

.words-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.bulk-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-tertiary-color);
  padding: 8px 16px;
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid var(--border-primary-color);
  flex-wrap: wrap;
  gap: 8px;

  .selected-count {
    font-weight: 600;
    color: var(--fg-accent-color);
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .divider {
    width: 1px;
    height: 20px;
    background-color: var(--border-secondary-color);
    margin: 0 4px;
    @include media-down(sm) {
      display: none;
    }
  }
}

.virtual-list-container {
  flex-grow: 1;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}
.virtual-list-wrapper {
  display: flex;
  flex-direction: column;
}
.dict-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 12px;
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  &.is-selected {
    border-color: var(--fg-accent-color);
    background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);
  }

  .checkbox-col {
    padding-top: 2px;
  }

  .dict-item-content {
    flex-grow: 1;
    min-width: 0;
  }
  .dict-word-container {
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .dict-word {
      font-size: 1.2rem;
      font-weight: bold;
      color: var(--fg-accent-color);
    }

    .dict-transcription {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
    }
  }
  .dict-translation {
    font-size: 0.95rem;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .dict-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}

.diff-badge {
  font-size: 0.7rem;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-primary-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;

  &.level-easy {
    background-color: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.15);
    color: var(--fg-success-color);
  }
  &.level-medium {
    background-color: rgba(var(--bg-warning-color-rgb, 227, 179, 65), 0.15);
    color: var(--fg-warning-color);
  }
  &.level-hard {
    background-color: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.15);
    color: var(--fg-error-color);
  }
}

.srs-badge {
  font-size: 0.7rem;
  padding: 1px 5px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-weight: 500;
  opacity: 0.8;
  margin-left: auto;
  margin-right: 8px;
}

.empty-state {
  text-align: center;
  margin-top: 60px;
  color: var(--fg-secondary-color);

  .empty-hint {
    font-size: 0.9rem;
    margin-top: 8px;
    opacity: 0.8;
  }
}

.dropdown-menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--fg-primary-color);
  font-size: 0.95rem;
  font-family: inherit;
  cursor: pointer;
  border-radius: 6px;
  transition:
    background-color 0.2s,
    color 0.2s;
  text-align: left;
  width: 100%;

  &:hover:not(:disabled) {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    font-size: 1.25rem;
    color: var(--fg-secondary-color);
  }

  &:hover:not(:disabled) svg {
    color: var(--fg-accent-color);
  }
}

.manage-decks-content {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .create-deck-row {
    display: flex;
    gap: 8px;

    :deep(.kit-input-wrapper) {
      flex: 1;
    }
    .new-deck-lang {
      width: 140px;
      flex-shrink: 0;
    }
  }

  .decks-manage-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 350px;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background-color: var(--border-primary-color);
      border-radius: 4px;
    }
  }

  .deck-manage-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background-color: var(--bg-tertiary-color);
    border-radius: 8px;
    border: 1px solid var(--border-secondary-color);

    .deck-info {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
      flex-grow: 1;

      svg {
        font-size: 1.2rem;
        color: var(--fg-secondary-color);
        flex-shrink: 0;
      }

      .deck-name {
        font-weight: 500;
        color: var(--fg-primary-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .deck-lang {
        font-size: 0.75rem;
        background-color: var(--bg-primary-color);
        padding: 2px 6px;
        border-radius: 4px;
        color: var(--fg-secondary-color);
        border: 1px solid var(--border-primary-color);
      }
    }

    .deck-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mr-2 {
  margin-right: 8px;
}
</style>
