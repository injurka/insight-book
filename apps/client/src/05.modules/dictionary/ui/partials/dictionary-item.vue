<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { DIFFICULTY_SYSTEMS } from '~/01.shared/constants/difficulties'
import { KitBtn, KitCheckbox, KitTooltip } from '~/02.kit'

interface Props {
  item: UserDictItem
  viewMode: 'list' | 'grid'
  isEditMode: boolean
  isSelected: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  click: [item: UserDictItem]
  toggleSelection: [id: number]
  edit: [item: UserDictItem]
  delete: [word: string]
}>()

const { t } = useI18n()

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
</script>

<template>
  <div
    class="dict-item"
    :class="{ 'is-selected': isSelected, 'is-grid-mode': viewMode === 'grid' }"
    @click="emit('click', item)"
  >
    <div v-if="isEditMode" class="checkbox-col" @click.stop>
      <KitCheckbox
        :model-value="isSelected"
        @update:model-value="emit('toggleSelection', item.id)"
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
          @click="emit('edit', item)"
        />
      </KitTooltip>
      <KitTooltip :text="t('dictionary.deleteItem')" placement="top-end">
        <KitBtn
          icon="mdi:delete-outline"
          variant="text"
          size="xs"
          color="error"
          @click="emit('delete', item.word)"
        />
      </KitTooltip>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Сюда переносятся все стили .dict-item, .diff-badge, .srs-badge, .multi-deck-badge из dictionary-list.vue */
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
</style>
