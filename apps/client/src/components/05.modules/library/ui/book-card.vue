<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { computed } from 'vue'
import { KitBtn } from '~/components/01.kit'
import { getMediaUrl } from '~/workers/service/lib/utils'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'click'): void
}>()

interface Props {
  book: Book
}

const coverSrc = computed(() => {
  if (!props.book.coverUrl)
    return ''
  return props.book.coverUrl.startsWith('data:')
    ? props.book.coverUrl
    : `${getMediaUrl(props.book.coverUrl)}`
})

const progressPercent = computed(() => {
  const current = props.book.currentPage || 1
  const total = props.book.totalPages || 1
  return (current / total) * 100
})
</script>

<template>
  <div class="book-card" @click="emit('click')">
    <div class="cover-wrapper">
      <img v-if="coverSrc" :src="coverSrc" alt="Обложка" class="cover-img">
      <div v-else class="cover-placeholder">
        <span class="placeholder-icon">📚</span>
      </div>
      <span class="lang-badge">{{ book.language.toUpperCase() }}</span>

      <div class="card-actions">
        <KitBtn
          class="action-btn"
          icon="mdi:file-document-edit-outline"
          variant="solid"
          color="secondary"
          size="xs"
          title="Редактировать"
          @click.stop="emit('edit')"
        />
      </div>
    </div>

    <div class="book-info">
      <h2 class="title" :title="book.title">
        {{ book.title }}
      </h2>
      <p v-if="book.author" class="author">
        {{ book.author }}
      </p>
      <div class="progress">
        <span>Стр. {{ book.currentPage || 1 }} из {{ book.totalPages }}</span>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.book-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
  display: flex;
  flex-direction: column;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
    border-color: var(--fg-accent-color);

    .card-actions {
      opacity: 1;
      visibility: visible;
    }
  }

  .cover-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    background-color: var(--bg-tertiary-color);
    overflow: hidden;
    border-bottom: 1px solid var(--border-secondary-color);

    .cover-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .cover-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      opacity: 0.5;
    }

    .lang-badge {
      position: absolute;
      top: 8px;
      left: 8px;
      background: var(--bg-overlay-secondary-color);
      color: var(--fg-inverted-color);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      backdrop-filter: blur(4px);
    }

    .card-actions {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 6px;
      transition: all 0.2s ease-in-out;
      z-index: 10;
      opacity: 0;
      visibility: hidden;

      @include media-down(md) {
        opacity: 1;
        visibility: visible;
      }

      .action-btn {
        box-shadow: none;
        color: var(--fg-primary-color);
      }
    }
  }

  .book-info {
    padding: 16px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    .title {
      margin: 0 0 6px 0;
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      color: var(--fg-primary-color);
    }

    .author {
      margin: 0 0 16px 0;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
    }

    .progress {
      margin-top: auto;
      font-size: 0.85rem;
      color: var(--fg-muted-color);

      .progress-bar {
        margin-top: 6px;
        height: 4px;
        background-color: var(--bg-tertiary-color);
        border-radius: 2px;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          background-color: var(--fg-accent-color);
          border-radius: 2px;
          transition: width 0.3s ease;
        }
      }
    }
  }
}
</style>
