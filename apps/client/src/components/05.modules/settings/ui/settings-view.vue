<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { KitBtn, KitCheckbox, KitInput, KitSkeleton, KitTooltip } from '~/components/01.kit'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useCacheStore } from '~/shared/store/cache.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const cacheStore = useCacheStore()
const settingsStore = useGlobalSettingsStore()
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

  const sorted = [...pages].sort((a, b) => a - b)
  if (sorted.length <= 15)
    return sorted.join(', ')
  return `${sorted.slice(0, 15).join(', ')} ... и ещё ${sorted.length - 15}`
}

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
        <h1>Настройки</h1>
        <p>Память, оффлайн режим и ИИ</p>
      </div>
    </header>

    <div v-if="cacheStore.isLoading" class="loading-state">
      <KitSkeleton width="100%" height="150px" border-radius="12px" class="mb-4" />
      <KitSkeleton width="100%" height="200px" border-radius="12px" />
    </div>

    <div v-else-if="cacheStore.stats" class="content">
      <!-- Настройки ИИ -->
      <h2 class="section-title">
        Искусственный интеллект
      </h2>
      <div class="settings-card llm-card">
        <div class="llm-toggle">
          <KitCheckbox v-model="settingsStore.useCustomLlm" label="Использовать локальный/собственный LLM (Ollama, LM Studio и др.)" />
        </div>

        <Transition name="fade">
          <div v-if="settingsStore.useCustomLlm" class="custom-llm-form">
            <p class="hint">
              Укажите эндпоинт, совместимый с OpenAI API. Убедитесь, что ваш сервер разрешает CORS-запросы (например, для Ollama <code>OLLAMA_ORIGINS="*"</code>).
            </p>
            <div class="form-row">
              <div class="form-group flex-2">
                <label>API URL</label>
                <KitInput v-model="settingsStore.customLlmUrl" placeholder="http://localhost:11434/v1" />
              </div>
              <div class="form-group flex-1">
                <label>Название модели</label>
                <KitInput v-model="settingsStore.customLlmModel" placeholder="llama3, qwen2..." />
              </div>
              <div class="form-group flex-1">
                <label>API Key</label>
                <KitInput v-model="settingsStore.customLlmKey" placeholder="Любой ключ" />
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Хранилище -->
      <h2 class="section-title">
        Локальная память
      </h2>
      <div v-if="cacheStore.deviceStorage" class="settings-card quota-card">
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

      <div class="settings-card total-card">
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
          class="settings-card book-cache-card"
        >
          <div class="book-card-header">
            <div class="title-section">
              <div class="icon-wrapper">
                <Icon icon="mdi:book-open-variant" />
              </div>
              <h3>{{ book.title }}</h3>
            </div>

            <KitBtn
              icon="mdi:delete-outline"
              variant="outlined"
              class="delete-btn"
              :disabled="book.cachedPages.length === 0 && book.analysesCount === 0 && book.sizeBytes === 0"
              @click="cacheStore.clearBookCache(Number(id))"
            />
          </div>

          <div class="book-card-body">
            <div class="stats-badges">
              <div class="badge">
                <Icon icon="mdi:database-outline" />
                <span>{{ formatBytes(book.sizeBytes) }}</span>
              </div>
              <div class="badge">
                <Icon icon="mdi:robot-outline" />
                <span>Анализов ИИ: <b>{{ book.analysesCount }}</b></span>
              </div>
              <div class="badge">
                <Icon icon="mdi:file-document-edit-outline" />
                <span>Страниц в кэше: <b>{{ book.cachedPages.length }} / {{ book.totalPages }}</b></span>
              </div>
            </div>

            <div class="cache-progress-section">
              <div class="progress-bar-wrap">
                <div
                  class="progress-fill"
                  :style="{ width: `${book.totalPages > 0 ? (book.cachedPages.length / book.totalPages) * 100 : 0}%` }"
                />
              </div>
              <div class="progress-footer">
                <span class="progress-text">
                  Оффлайн доступно <b>{{ book.totalPages > 0 ? Math.round((book.cachedPages.length / book.totalPages) * 100) : 0 }}%</b> книги
                </span>

                <KitTooltip v-if="book.cachedPages.length > 0" :text="formatPagesList(book.cachedPages)" placement="top-end">
                  <span class="pages-list-hint">Номера страниц</span>
                </KitTooltip>
              </div>
            </div>
          </div>
        </div>

        <div v-if="Object.keys(cacheStore.stats.bookStats).length === 0" class="empty-state">
          <Icon icon="mdi:folder-open-outline" class="empty-icon" />
          <p>Книг в библиотеке нет.</p>
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
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;

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

.section-title {
  margin-top: 32px;
  margin-bottom: 16px;
  font-size: 1.4rem;
}

.settings-card {
  background: var(--bg-secondary-color);
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 16px;
}

.llm-card {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .custom-llm-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 12px;
    border-top: 1px dashed var(--border-secondary-color);
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    code {
      background: var(--bg-tertiary-color);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--fg-accent-color);
    }
  }

  .form-row {
    display: flex;
    gap: 16px;
    @include media-down(sm) {
      flex-direction: column;
    }
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;

    label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }

    &.flex-2 {
      flex: 2;
    }
    &.flex-1 {
      flex: 1;
    }
  }
}

.quota-card {
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

      .badge-safe,
      .badge-warn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 99px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .badge-safe {
        background: rgba(var(--bg-success-color-rgb, 38, 157, 105), 0.2);
        color: var(--fg-success-color);
      }
      .badge-warn {
        background: rgba(var(--bg-warning-color-rgb, 225, 96, 50), 0.2);
        color: var(--fg-warning-color);
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

.total-card {
  display: flex;
  gap: 48px;
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

.books-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.book-cache-card {
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  &:hover {
    border-color: var(--border-accent-color);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  }

  .book-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;

    @include media-down(sm) {
      flex-direction: column;
    }

    .title-section {
      display: flex;
      align-items: center;
      gap: 16px;

      .icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
        color: var(--fg-accent-color);
        border-radius: 12px;
        font-size: 1.6rem;
        flex-shrink: 0;
      }

      h3 {
        margin: 0;
        font-size: 1.15rem;
        color: var(--fg-primary-color);
        font-weight: 600;
        line-height: 1.4;
      }
    }

    .delete-btn {
      color: var(--fg-error-color) !important;
      border-color: var(--border-error-color) !important;
      flex-shrink: 0;
      padding: 0.5rem;

      &:hover:not(:disabled) {
        background-color: var(--bg-error-color) !important;
        color: white !important;
      }

      @include media-down(sm) {
        width: 100%;
      }
    }
  }

  .book-card-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .stats-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    .badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);

      svg {
        font-size: 1.2rem;
        color: var(--fg-primary-color);
      }

      b {
        color: var(--fg-primary-color);
        font-weight: 600;
      }
    }
  }

  .cache-progress-section {
    background: var(--bg-secondary-color);
    padding: 16px;
    border-radius: 12px;

    .progress-bar-wrap {
      width: 100%;
      height: 6px;
      background-color: var(--bg-tertiary-color);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 12px;

      .progress-fill {
        height: 100%;
        background-color: var(--fg-accent-color);
        border-radius: 3px;
        transition: width 0.3s ease;
      }
    }

    .progress-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;

      .progress-text {
        color: var(--fg-secondary-color);
        b {
          color: var(--fg-primary-color);
        }
      }

      .pages-list-hint {
        color: var(--fg-accent-color);
        cursor: help;
        font-weight: 500;
        text-decoration: underline;
        text-decoration-style: dashed;
        text-decoration-color: var(--fg-accent-color);
        text-underline-offset: 4px;
        padding-left: 12px;
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px;
  color: var(--fg-secondary-color);
  border: 1px dashed var(--border-primary-color);
  border-radius: 16px;
  background-color: var(--bg-secondary-color);

  .empty-icon {
    font-size: 3rem;
    opacity: 0.5;
  }

  p {
    margin: 0;
    font-size: 1.1rem;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
