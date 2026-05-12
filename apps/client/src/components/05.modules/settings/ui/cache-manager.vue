<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn, KitSkeleton, KitTooltip } from '~/components/01.kit'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useCacheStore } from '~/shared/store/cache.store'

const cacheStore = useCacheStore()
const router = useRouter()

onMounted(() => {
  cacheStore.loadStats()
})

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0 || !bytes)
    return '0 Байт'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

function formatPagesList(pages: number[]) {
  if (pages.length === 0)
    return 'Нет сохраненных страниц'
  if (pages.length <= 15)
    return pages.join(', ')
  return `${pages.slice(0, 15).join(', ')} ... и ещё ${pages.length - 15}`
}

// Вычисляем процент заполненности квоты (с защитой от деления на 0)
const storagePercent = computed(() => {
  if (!cacheStore.deviceStorage || cacheStore.deviceStorage.quota === 0)
    return 0
  return Math.min(100, Math.round((cacheStore.deviceStorage.usage / cacheStore.deviceStorage.quota) * 100))
})
</script>

<template>
  <div class="cache-manager-page">
    <header class="page-header">
      <KitBtn icon="mdi:arrow-left" variant="text" @click="router.push(AppRoutePaths.Home)" />
      <div class="header-title">
        <h1>Память и Оффлайн</h1>
        <p>Управление сохраненными книгами и словарями</p>
      </div>
    </header>

    <div v-if="cacheStore.isLoading" class="loading-state">
      <KitSkeleton width="100%" height="150px" border-radius="12px" class="mb-4" />
      <KitSkeleton width="100%" height="200px" border-radius="12px" />
    </div>

    <div v-else-if="cacheStore.stats" class="content">
      <!-- Блок браузерной квоты -->
      <div v-if="cacheStore.deviceStorage" class="quota-card">
        <div class="quota-header">
          <div class="quota-title">
            <h3>Хранилище браузера</h3>
            <KitTooltip
              v-if="cacheStore.isPersisted"
              text="Браузер не удалит ваши данные при нехватке места"
              placement="top"
            >
              <div class="badge-safe">
                <Icon icon="mdi:shield-check" /> Защищено
              </div>
            </KitTooltip>
            <KitTooltip
              v-else
              text="При нехватке памяти браузер может автоматически удалить кэш"
              placement="top"
            >
              <div class="badge-warn">
                <Icon icon="mdi:shield-alert-outline" /> Не защищено
              </div>
            </KitTooltip>
          </div>
          <span class="quota-text">
            <b>{{ formatBytes(cacheStore.deviceStorage.usage) }}</b> / {{ formatBytes(cacheStore.deviceStorage.quota) }}
          </span>
        </div>

        <div class="progress-bar-wrap">
          <div
            class="progress-fill"
            :class="{ 'is-danger': storagePercent > 90, 'is-warning': storagePercent > 70 }"
            :style="{ width: `${storagePercent}%` }"
          />
        </div>
        <p class="quota-desc">
          Показан общий объем, выделенный браузером. Само приложение занимает около {{ formatBytes(cacheStore.stats.totalSizeBytes) }}.
        </p>
      </div>

      <div class="total-card">
        <div class="stat-item">
          <span class="label">Занято базой данных:</span>
          <span class="value text-accent">{{ formatBytes(cacheStore.stats.totalSizeBytes) }}</span>
        </div>
        <div class="stat-item">
          <span class="label">Слов в словаре:</span>
          <span class="value">{{ cacheStore.stats.totalDictionaryWords }}</span>
        </div>
      </div>

      <h2 class="section-title">
        Сохраненные данные книг
      </h2>

      <div class="books-list">
        <div
          v-for="(book, id) in cacheStore.stats.bookStats"
          :key="id"
          class="book-cache-card"
        >
          <div class="book-info">
            <h3>{{ book.title }}</h3>

            <div class="details-grid">
              <div class="detail-box page-box">
                <span class="d-label">Страницы ({{ book.cachedPages.length }} из {{ book.totalPages }})</span>
                <span class="d-value text-small">{{ formatPagesList(book.cachedPages) }}</span>
              </div>

              <div class="detail-box">
                <span class="d-label">Анализы ИИ</span>
                <span class="d-value">{{ book.analysesCount }} слов/предложений</span>
              </div>

              <div class="detail-box">
                <span class="d-label">Размер кэша</span>
                <span class="d-value">{{ formatBytes(book.sizeBytes) }}</span>
              </div>
            </div>
          </div>

          <div class="actions">
            <KitBtn
              icon="mdi:delete-outline"
              variant="outlined"
              :disabled="book.cachedPages.length === 0 && book.analysesCount === 0 && book.sizeBytes === 0"
              @click="cacheStore.clearBookCache(Number(id))"
            >
              Очистить
            </KitBtn>
          </div>
        </div>

        <div v-if="Object.keys(cacheStore.stats.bookStats).length === 0" class="empty-state">
          Книг в библиотеке нет.
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cache-manager-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
  min-height: 100dvh;

  @include media-down(md) {
    padding: 16px;
  }
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;

  .header-title {
    h1 {
      margin: 0 0 4px;
      font-size: 1.8rem;
    }
    p {
      margin: 0;
      color: var(--fg-secondary-color);
    }
  }
}

/* --- QUOTA CARD --- */
.quota-card {
  background: var(--bg-tertiary-color);
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 16px;

  .quota-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    @include media-down(sm) {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }

    .quota-title {
      display: flex;
      align-items: center;
      gap: 12px;

      h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--fg-primary-color);
      }

      .badge-safe {
        display: flex;
        align-items: center;
        gap: 4px;
        background: rgba(var(--bg-success-color-rgb, 38, 157, 105), 0.2);
        color: var(--fg-success-color);
        padding: 2px 8px;
        border-radius: 99px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .badge-warn {
        display: flex;
        align-items: center;
        gap: 4px;
        background: rgba(var(--bg-warning-color-rgb, 225, 96, 50), 0.2);
        color: var(--fg-warning-color);
        padding: 2px 8px;
        border-radius: 99px;
        font-size: 0.75rem;
        font-weight: 600;
      }
    }

    .quota-text {
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      b {
        color: var(--fg-primary-color);
      }
    }
  }

  .progress-bar-wrap {
    width: 100%;
    height: 12px;
    background-color: var(--bg-primary-color);
    border-radius: 6px;
    overflow: hidden;
    margin-bottom: 12px;

    .progress-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      transition:
        width 0.5s ease-in-out,
        background-color 0.3s;

      &.is-warning {
        background-color: var(--fg-warning-color);
      }
      &.is-danger {
        background-color: var(--fg-error-color);
      }
    }
  }

  .quota-desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }
}

/* --- STATS CARD --- */
.total-card {
  display: flex;
  gap: 48px;
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 32px;

  @include media-down(sm) {
    flex-direction: column;
    gap: 16px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .label {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .value {
      font-size: 2rem;
      font-weight: 600;

      &.text-accent {
        color: var(--fg-accent-color);
      }
    }
  }
}

.section-title {
  margin-bottom: 16px;
  font-size: 1.4rem;
}

.books-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.book-cache-card {
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--fg-accent-color);
  }

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
  }

  .book-info {
    flex-grow: 1;

    h3 {
      margin: 0 0 16px;
      font-size: 1.2rem;
      color: var(--fg-primary-color);
    }
  }

  .details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;

    .page-box {
      grid-column: 1 / -1;
    }

    .detail-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--bg-secondary-color);
      padding: 12px;
      border-radius: 8px;

      .d-label {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
      }
      .d-value {
        font-size: 0.95rem;
        font-weight: 500;

        &.text-small {
          font-weight: normal;
          color: var(--fg-primary-color);
          line-height: 1.4;
        }
      }
    }
  }

  .actions {
    flex-shrink: 0;

    .kit-btn {
      color: var(--fg-error-color) !important;
      border-color: var(--border-error-color) !important;

      &:hover:not(:disabled) {
        background-color: var(--bg-error-color) !important;
        color: white !important;
      }
    }
  }
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--fg-secondary-color);
  border: 1px dashed var(--border-primary-color);
  border-radius: 12px;
}

.mb-4 {
  margin-bottom: 16px;
}
</style>
