<script setup lang="ts">
import type { Book } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitImage, KitTooltip } from '~/components/01.kit'
import { useAuthStore } from '~/shared/store/auth.store'

const props = defineProps<{ book: Book }>()

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'click'): void
}>()

const authStore = useAuthStore()
const { t } = useI18n()

const progressPercent = computed(() => {
  const current = props.book.currentPage || 1
  const total = props.book.totalPages || 1
  return (current / total) * 100
})
</script>

<template>
  <div class="book-card" @click="(!book.processStatus || book.processStatus === 'ready') ? emit('click') : null">
    <div class="cover-wrapper">
      <KitImage
        :src="book.localCoverUrl || book.coverUrl"
        :alt="t('library.cover')"
        fallback-icon="mdi:book-open-blank-variant"
      />

      <!-- Оверлей статуса обработки -->
      <div v-if="book.processStatus === 'processing'" class="processing-overlay">
        <Icon icon="mdi:loading" class="spin-icon" />
        <span class="overlay-text">{{ t('library.uploadingWait') }}</span>
      </div>

      <div v-else-if="book.processStatus === 'error'" class="processing-overlay error">
        <Icon icon="mdi:alert-circle-outline" class="error-icon" />
        <span class="overlay-text error-text" :title="book.processError || t('library.updateError')">
          {{ book.processError || t('library.updateError') }}
        </span>
      </div>

      <span class="lang-badge">{{ book.language.toUpperCase() }}</span>

      <span v-if="book.seriesNumber" class="series-number-badge">
        #{{ book.seriesNumber }}
      </span>
    </div>

    <div class="book-info">
      <div class="info-header">
        <h2 class="title" :title="book.title">
          {{ book.title }}
        </h2>

        <div v-if="authStore.user" class="header-actions">
          <KitTooltip :text="book.userId === authStore.user.id ? t('library.edit') : t('library.removeFromLibrary')" placement="top-end">
            <button class="edit-btn" @click.stop="emit('edit')">
              <Icon :icon="book.userId === authStore.user.id ? 'mdi:dots-vertical' : 'mdi:close'" />
            </button>
          </KitTooltip>
        </div>
      </div>

      <p v-if="book.author" class="author">
        {{ book.author }}
      </p>

      <div class="progress">
        <span>{{ t('library.pageProgress', { current: book.currentPage || 1, total: book.totalPages || 0 }) }}</span>
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

    .edit-btn {
      opacity: 1 !important;
    }

    :deep(.real-image) {
      transform: scale(1.05);
    }
  }

  .cover-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    border-bottom: 1px solid var(--border-secondary-color);
    overflow: hidden;

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
      z-index: 10;
    }

    .series-number-badge {
      position: absolute;
      bottom: 8px;
      right: 12px;
      font-family: 'Maple Mono CN', serif;
      font-size: 2.4rem;
      font-weight: 700;
      font-style: italic;
      line-height: 1;
      color: rgba(255, 255, 255, 0.5);
      text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
      z-index: 5;
      pointer-events: none;
      user-select: none;
    }

    .processing-overlay {
      position: absolute;
      inset: 0;
      background-color: rgba(var(--bg-primary-color-rgb, 0, 0, 0), 0.75);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--fg-primary-color);
      text-align: center;
      padding: 16px;
      gap: 12px;

      .spin-icon {
        font-size: 2.5rem;
        color: var(--fg-accent-color);
        animation: spin 1s linear infinite;
      }

      .error-icon {
        font-size: 2.5rem;
        color: var(--fg-error-color);
      }

      .overlay-text {
        font-size: 0.9rem;
        font-weight: 500;
        line-height: 1.4;
      }

      .error-text {
        color: var(--fg-error-color);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      &.error {
        background-color: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.15);
      }
    }

    :deep(.kit-image) {
      img {
        object-fit: fill;
        transform: scale(1.01);
      }
    }
  }

  .book-info {
    padding: 16px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;

    .info-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;

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
        flex-grow: 1;
      }

      .header-actions {
        flex-shrink: 0;
        margin: -4px -8px 0 0;
      }

      .edit-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        color: var(--fg-secondary-color);
        padding: 4px;
        font-size: 1.25rem;
        cursor: pointer;
        border-radius: 6px;
        transition:
          background-color 0.2s,
          color 0.2s,
          opacity 0.2s;

        opacity: 0;

        &:hover {
          background-color: var(--bg-hover-color);
          color: var(--fg-primary-color);
        }
      }
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

  @include media-down(sm) {
    flex-direction: row;
    padding: 12px;
    align-items: center;

    &:hover {
      transform: translateY(-2px);
    }

    .cover-wrapper {
      width: auto;
      height: 120px;
      flex-shrink: 0;
      border-bottom: none;
      border-radius: 6px;

      .lang-badge {
        top: 4px;
        left: 4px;
        padding: 2px 4px;
        font-size: 0.65rem;
      }

      .series-number-badge {
        bottom: 4px;
        right: 6px;
        font-size: 1.5rem;
      }

      .processing-overlay {
        .spin-icon,
        .error-icon {
          font-size: 1.5rem;
        }
        .overlay-text {
          display: none; // Скрываем текст лоадера на мобилках из-за нехватки места
        }
      }
    }

    .book-info {
      padding: 0 0 0 16px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-self: stretch;

      .info-header {
        .title {
          font-size: 1rem;
          margin-bottom: 4px;
        }

        .edit-btn {
          opacity: 1;
        }
      }

      .author {
        margin-bottom: 8px;
        font-size: 0.85rem;
      }

      .progress {
        font-size: 0.8rem;
      }
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
