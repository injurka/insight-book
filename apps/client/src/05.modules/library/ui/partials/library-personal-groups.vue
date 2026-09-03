<script setup lang="ts">
import type { DisplayGroup } from '../../model'
import type { Book } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import BookCard from '../book-card.vue'

interface Props {
  groups: DisplayGroup[]
  currentView: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'openBook', book: Book): void
  (e: 'editBook', book: Book): void
}>()

const activeFolder = defineModel<string | null>('activeFolder')

const { t } = useI18n()

function getFolderIcon(view: string) {
  if (view === 'authors')
    return 'mdi:account'
  if (view === 'series')
    return 'mdi:folder'
  if (view === 'collections')
    return 'mdi:bookshelf'

  return 'mdi:folder'
}
</script>

<template>
  <div class="library-groups">
    <template v-for="group in groups" :key="group.seriesName">
      <div class="series-section">
        <h3 class="series-title">
          <KitBtn
            v-if="group.isFolderContent"
            icon="mdi:arrow-left"
            variant="text"
            size="xs"
            class="back-btn"
            @click="activeFolder = null"
          />
          <Icon v-else :icon="group.icon || 'mdi:folder-outline'" />
          <span class="text">{{ group.seriesName }}</span>
        </h3>

        <div v-if="group.folders" class="folders-list">
          <div v-if="group.folders.length === 0" class="empty-state">
            <h2>{{ t('library.emptySection') }}</h2>
          </div>
          <div
            v-for="folder in group.folders"
            v-else
            :key="folder.name"
            class="folder-item"
            @click="activeFolder = folder.name"
          >
            <Icon :icon="getFolderIcon(currentView)" class="folder-icon" />
            <span class="folder-name">{{ folder.name }}</span>
            <span class="folder-count">{{ folder.count }}</span>
          </div>
        </div>

        <div v-else>
          <div v-if="group.books?.length === 0" class="empty-state">
            <h2>{{ t('library.emptySection') }}</h2>
          </div>
          <div v-else-if="group.books" class="books-grid">
            <BookCard
              v-for="book in group.books"
              :key="book.id"
              :book="book"
              @click="emit('openBook', book)"
              @edit="emit('editBook', book)"
            />
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.library-groups {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding-bottom: 24px;
}

.series-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  color: var(--fg-accent-color);
  margin: 0 0 16px 0;
  border-bottom: 2px solid var(--border-secondary-color);
  padding-bottom: 8px;
  height: 28px;

  .back-btn {
    margin-right: -4px;
    margin-left: -8px;
  }
  .text {
    flex-grow: 1;
  }
}

.folders-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.folder-item {
  display: flex;
  align-items: center;
  background-color: var(--bg-secondary-color);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition:
    border-color 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
  }

  .folder-icon {
    font-size: 1.5rem;
    color: var(--fg-secondary-color);
    margin-right: 16px;
  }

  .folder-name {
    flex-grow: 1;
    font-size: 1.05rem;
    color: var(--fg-primary-color);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .folder-count {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    background-color: var(--bg-tertiary-color);
    padding: 2px 10px;
    border-radius: 99px;
  }
}

.empty-state {
  text-align: center;
  padding: 64px 24px;
  background-color: var(--bg-secondary-color);
  border-radius: 16px;
  border: 1px dashed var(--border-primary-color);
  h2 {
    margin-bottom: 12px;
    color: var(--fg-primary-color);
  }
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
