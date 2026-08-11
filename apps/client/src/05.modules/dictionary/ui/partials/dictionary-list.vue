<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { useElementSize, useVirtualList } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { KitPrompt } from '~/02.kit/organisms/kit-prompt/ui'
import { useAnkiExport } from '../../composables/use-anki-export'
import { useDictionaryStore } from '../../store/dictionary.store'
import DictionaryItem from './dictionary-item.vue'
import DictionarySkeletonList from './dictionary-skeleton-list.vue'

interface Props {
  isEditMode: boolean
  viewMode: 'list' | 'grid'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  openDetails: [item: UserDictItem]
  openBulkMove: []
}>()

const store = useDictionaryStore()
const analysisStore = useAnalysisStore()
const { t } = useI18n()
const { exportToAnki } = useAnkiExport()

const { list, containerProps, wrapperProps } = useVirtualList(computed(() => store.filteredWords), { itemHeight: 110 })

const gridContainerRef = shallowRef<HTMLElement | null>(null)
const { width: gridContainerWidth } = useElementSize(gridContainerRef)

const gridColumns = computed(() => {
  const w = gridContainerWidth.value
  if (!w || w <= 0)
    return 3

  return Math.max(1, Math.floor((w + 16) / (280 + 16)))
})

const gridRows = computed(() => {
  const wordsList = store.filteredWords
  const cols = gridColumns.value
  const rows: UserDictItem[][] = []
  for (let i = 0; i < wordsList.length; i += cols)
    rows.push(wordsList.slice(i, i + cols))

  return rows
})

const { list: gridList, containerProps: gridContainerProps, wrapperProps: gridWrapperProps } = useVirtualList(gridRows, { itemHeight: 140 })

watch(() => gridContainerProps.ref.value, (el) => {
  if (el)
    gridContainerRef.value = el
}, { immediate: true })

function handleItemClick(item: UserDictItem) {
  if (props.isEditMode) {
    store.toggleWordSelection(item.id)

    return
  }

  emit('openDetails', item)
}

function handleExport() {
  const wordsToExport = store.words.filter(w => store.selectedWordIds.has(w.id))
  exportToAnki(wordsToExport)
  store.clearSelection()
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

function handleEditWord(item: UserDictItem) {
  analysisStore.wordToEdit = item
  analysisStore.addEditWordModalOpen = true
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
              @click="handleExport"
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

    <DictionarySkeletonList v-if="store.isLoading && !store.words.length" :view-mode="viewMode" />

    <div v-else-if="!store.words.length" class="empty-state">
      <p>{{ t('dictionary.emptyState') }}</p>
    </div>

    <div v-else-if="!store.filteredWords.length" class="empty-state">
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
          :style="{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }"
        >
          <DictionaryItem
            v-for="item in row.data"
            :key="item.id"
            :item="item"
            view-mode="grid"
            :is-edit-mode="isEditMode"
            :is-selected="store.selectedWordIds.has(item.id)"
            @click="handleItemClick"
            @toggle-selection="store.toggleWordSelection"
            @edit="handleEditWord"
            @delete="openDeleteWord"
          />
        </div>
      </div>
    </div>

    <div v-else class="virtual-list-container" v-bind="containerProps">
      <div v-bind="wrapperProps" class="virtual-list-wrapper">
        <DictionaryItem
          v-for="item in list"
          :key="item.data.id"
          :item="item.data"
          view-mode="list"
          :is-edit-mode="isEditMode"
          :is-selected="store.selectedWordIds.has(item.data.id)"
          @click="handleItemClick"
          @toggle-selection="store.toggleWordSelection"
          @edit="handleEditWord"
          @delete="openDeleteWord"
        />
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
}
.bulk-action-bar .selected-count {
  font-weight: 600;
  color: var(--fg-accent-color);
}
.bulk-action-bar .actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.bulk-action-bar .divider {
  width: 1px;
  height: 20px;
  background-color: var(--border-secondary-color);
  margin: 0 4px;
}
.virtual-list-container {
  flex-grow: 1;
  min-height: 0;
  overflow-y: auto;
}
.virtual-list-container::-webkit-scrollbar {
  width: 6px;
}
.virtual-list-container::-webkit-scrollbar-thumb {
  background-color: var(--border-secondary-color);
  border-radius: 4px;
}
.virtual-list-wrapper {
  display: flex;
  flex-direction: column;
}
.dict-grid-row {
  display: grid;
  gap: 16px;
  width: 100%;
  margin-bottom: 16px;
}
.empty-state {
  text-align: center;
  margin-top: 60px;
  color: var(--fg-secondary-color);
}
.empty-state .empty-hint {
  font-size: 0.9rem;
  margin-top: 8px;
  opacity: 0.8;
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
