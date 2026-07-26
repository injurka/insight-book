<script setup lang="ts">
import type { UserDictItem } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { useVirtualList } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitPrompt, KitTooltip } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useUmami } from '~/shared/composables/use-umami'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store'
import { useDictionaryStore } from '../../store/dictionary.store'

const props = defineProps<{
  isEditMode: boolean
  viewMode: 'list' | 'grid'
}>()

const emit = defineEmits<{
  openDetails: [item: UserDictItem]
  openBulkMove: []
}>()

const store = useDictionaryStore()
const analysisStore = useAnalysisStore()
const toast = useToast()
const { trackEvent } = useUmami()
const { t } = useI18n()

const { list, containerProps, wrapperProps } = useVirtualList(
  computed(() => store.filteredWords),
  { itemHeight: 110 },
)

const gridColumns = ref(3)

const gridRows = computed(() => {
  const wordsList = store.filteredWords
  const cols = gridColumns.value
  const rows: UserDictItem[][] = []

  for (let i = 0; i < wordsList.length; i += cols) {
    rows.push(wordsList.slice(i, i + cols))
  }

  return rows
})

const {
  list: gridList,
  containerProps: gridContainerProps,
  wrapperProps: gridWrapperProps,
} = useVirtualList(gridRows, { itemHeight: 140 })

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

function handleItemClick(item: UserDictItem) {
  if (props.isEditMode) {
    store.toggleWordSelection(item.id)
    return
  }
  emit('openDetails', item)
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

const confirmDeleteVisible = ref(false)
const wordToDelete = ref<string | null>(null)
function openDeleteWord(word: string) {
  wordToDelete.value = word
  confirmDeleteVisible.value = true
}

function handleConfirmDelete() {
  if (wordToDelete.value) {
    store.deleteWord(wordToDelete.value)
    wordToDelete.value = null
  }
}
</script>

<template>
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
            <KitBtn
              size="sm"
              color="primary"
              variant="tonal"
              icon="mdi:export-variant"
              @click="exportToAnki"
            >
              {{ t('dictionary.exportAnki') }}
            </KitBtn>
          </KitTooltip>
          <KitBtn
            size="sm"
            color="primary"
            variant="tonal"
            icon="mdi:folder-move-outline"
            @click="emit('openBulkMove')"
          >
            {{ t('dictionary.move') }}
          </KitBtn>
          <KitBtn
            size="sm"
            color="error"
            variant="tonal"
            icon="mdi:delete-outline"
            @click="store.bulkDelete()"
          >
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

    <div v-else-if="viewMode === 'grid'" class="virtual-list-container" v-bind="gridContainerProps">
      <div v-bind="gridWrapperProps" class="virtual-list-wrapper">
        <div
          v-for="row in gridList"
          :key="row.index"
          class="dict-grid-row"
        >
          <div
            v-for="item in row.data"
            :key="item.id"
            class="dict-item is-grid-mode"
            :class="{ 'is-selected': store.selectedWordIds.has(item.id) }"
            @click="handleItemClick(item)"
          >
            <div v-if="isEditMode" class="checkbox-col" @click.stop>
              <KitCheckbox
                :model-value="store.selectedWordIds.has(item.id)"
                @update:model-value="store.toggleWordSelection(item.id)"
              />
            </div>
            <div class="dict-item-content">
              <div class="dict-word-container">
                <div class="word-group">
                  <span class="dict-word">{{ item.word }}</span>
                  <span class="dict-transcription">{{ item.transcription }}</span>
                </div>
                <div class="badges-group">
                  <span
                    v-if="item.difficulty"
                    class="diff-badge"
                    :class="getDifficultyClass(item.language, item.difficulty)"
                  >
                    {{ item.difficulty }}
                  </span>
                  <KitTooltip v-if="item.deckIds && item.deckIds.length > 1" :text="t('dictionary.inMultipleDecks') || 'Слово в нескольких колодах'">
                    <span class="multi-deck-badge">
                      <Icon icon="mdi:folder-multiple-outline" />
                    </span>
                  </KitTooltip>
                  <span class="srs-badge" :style="{ color: getStatusLabel(item.state).color }">
                    {{ getStatusLabel(item.state).label }}
                  </span>
                </div>
              </div>
              <div class="dict-translation" v-html="item.translation" />
            </div>
            <div v-if="isEditMode" class="dict-actions" @click.stop>
              <KitTooltip :text="t('dictionary.editItem')" placement="top">
                <KitBtn
                  icon="mdi:pencil"
                  variant="text"
                  size="xs"
                  @click="analysisStore.wordToEdit = item; analysisStore.addEditWordModalOpen = true"
                />
              </KitTooltip>
              <KitTooltip :text="t('dictionary.deleteItem')" placement="top-end">
                <KitBtn
                  icon="mdi:delete-outline"
                  variant="text"
                  size="xs"
                  color="error"
                  @click="openDeleteWord(item.word)"
                />
              </KitTooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="virtual-list-container" v-bind="containerProps">
      <div v-bind="wrapperProps" class="virtual-list-wrapper">
        <div
          v-for="item in list"
          :key="item.data.id"
          class="dict-item"
          :class="{ 'is-selected': store.selectedWordIds.has(item.data.id) }"
          @click="handleItemClick(item.data)"
        >
          <div v-if="isEditMode" class="checkbox-col" @click.stop>
            <KitCheckbox
              :model-value="store.selectedWordIds.has(item.data.id)"
              @update:model-value="store.toggleWordSelection(item.data.id)"
            />
          </div>
          <div class="dict-item-content">
            <div class="dict-word-container">
              <div class="word-group">
                <span class="dict-word">{{ item.data.word }}</span>
                <span class="dict-transcription">{{ item.data.transcription }}</span>
              </div>
              <div class="badges-group">
                <span
                  v-if="item.data.difficulty"
                  class="diff-badge"
                  :class="getDifficultyClass(item.data.language, item.data.difficulty)"
                >
                  {{ item.data.difficulty }}
                </span>
                <KitTooltip v-if="item.data.deckIds && item.data.deckIds.length > 1" :text="t('dictionary.inMultipleDecks') || 'Слово в нескольких колодах'">
                  <span class="multi-deck-badge">
                    <Icon icon="mdi:folder-multiple-outline" />
                  </span>
                </KitTooltip>
                <span class="srs-badge" :style="{ color: getStatusLabel(item.data.state).color }">
                  {{ getStatusLabel(item.data.state).label }}
                </span>
              </div>
            </div>
            <div class="dict-translation" v-html="item.data.translation" />
          </div>
          <div v-if="isEditMode" class="dict-actions" @click.stop>
            <KitTooltip :text="t('dictionary.editItem')" placement="top">
              <KitBtn
                icon="mdi:pencil"
                variant="text"
                size="xs"
                @click="analysisStore.wordToEdit = item.data; analysisStore.addEditWordModalOpen = true"
              />
            </KitTooltip>
            <KitTooltip :text="t('dictionary.deleteItem')" placement="top-end">
              <KitBtn
                icon="mdi:delete-outline"
                variant="text"
                size="xs"
                color="error"
                @click="openDeleteWord(item.data.word)"
              />
            </KitTooltip>
          </div>
        </div>
      </div>
    </div>

    <KitPrompt
      v-model:visible="confirmDeleteVisible"
      :title="t('dictionary.delete')"
      :description="t('dictionary.deletePrompt') || 'Удалить это слово?'"
      :hide-input="true"
      :confirm-text="t('dictionary.delete')"
      @submit="handleConfirmDelete"
    />
  </div>
</template>

<style lang="scss" scoped>
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

.dict-grid-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
  margin-bottom: 16px;
}

.dict-grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  overflow-y: auto;
  padding-right: 8px;
  padding-bottom: 24px;
  flex-grow: 1;
  align-content: start;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
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
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;

    .word-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .badges-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
      flex-shrink: 0;
      padding-top: 2px;
    }

    .dict-word {
      font-size: 1.2rem;
      font-weight: bold;
      color: var(--fg-accent-color);
      word-break: break-word;
      overflow-wrap: break-word;
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

  &.is-grid-mode {
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    margin-bottom: 0;
    height: auto;
    min-height: 120px;
    position: relative;

    .checkbox-col {
      position: absolute;
      top: 16px;
      right: 16px;
      padding-top: 0;
      z-index: 2;
    }

    .dict-item-content {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      width: 100%;
      min-width: 0;
    }

    .dict-word-container {
      margin-bottom: 12px;
      min-width: 0;
      width: 100%;
    }

    .dict-actions {
      flex-direction: row;
      margin-top: auto;
      justify-content: flex-end;
      width: 100%;
      border-top: 1px solid var(--border-secondary-color);
      padding-top: 8px;
    }
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
}

.multi-deck-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
  font-size: 1.1rem;
  margin-left: 4px;
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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
