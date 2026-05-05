<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn, KitInput, KitSkeleton } from '~/components/01.kit'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useBooksStore } from '~/shared/store/books.store'

const route = useRoute()
const router = useRouter()
const store = useBooksStore()

const bookId = computed(() => Number(route.params.id))

const coverInputRef = ref<HTMLInputElement | null>(null)

const isEditingStats = ref(false)
const editForm = reactive({
  difficulty: '',
  tags: '',
  description: '',
})

function goBack() {
  router.push(AppRoutePaths.Home)
}

function startReading() {
  if (store.currentBookInfo) {
    router.push({
      path: AppRoutePaths.Reader,
      query: { bookId: bookId.value, page: store.currentBookInfo.currentPage || 1 },
    })
  }
}

function goToPage(pageNum?: number) {
  if (!pageNum)
    return
  router.push({
    path: AppRoutePaths.Reader,
    query: { bookId: bookId.value, page: pageNum },
  })
}

function triggerAiAnalysis() {
  store.analyzeFullBook(bookId.value)
}

function onCoverChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    store.updateBookCover(bookId.value, target.files[0])
  }
}

function startEditingStats() {
  const stats = store.currentBookInfo?.stats
  editForm.difficulty = stats?.difficulty || ''
  editForm.tags = stats?.tags?.join(', ') || ''
  editForm.description = stats?.description || ''
  isEditingStats.value = true
}

async function saveStats() {
  const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
  await store.updateBookStats(bookId.value, {
    difficulty: editForm.difficulty,
    tags: tagsArray,
    description: editForm.description,
  })
  isEditingStats.value = false
}

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null)
    return '0'

  return new Intl.NumberFormat('ru-RU').format(num)
}

watch(
  bookId,
  (newId) => {
    if (newId) {
      store.fetchBookInfo(newId)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="book-info-page">
    <header class="page-header">
      <KitBtn icon="mdi:arrow-left" variant="text" @click="goBack" />
      <span class="header-title">О книге</span>
    </header>

    <div v-if="store.isLoading && !store.currentBookInfo" class="loading-state">
      <div class="layout-grid">
        <KitSkeleton width="100%" height="400px" border-radius="12px" />
        <div class="content-col">
          <KitSkeleton width="80%" height="32px" class="mb-4" />
          <KitSkeleton width="40%" height="20px" class="mb-4" />
          <KitSkeleton width="100%" height="150px" border-radius="12px" class="mb-4" />
        </div>
      </div>
    </div>

    <div v-else-if="store.currentBookInfo" class="book-container">
      <div class="layout-grid">
        <div class="cover-col">
          <div class="cover-wrapper group" @click="coverInputRef?.click()">
            <img v-if="store.currentBookInfo.coverBase64" :src="store.currentBookInfo.coverBase64" alt="Обложка">
            <div v-else class="cover-placeholder">
              <Icon icon="mdi:book-open-blank-variant" class="placeholder-icon" />
            </div>

            <div class="cover-overlay">
              <Icon icon="mdi:image-edit" class="mr-1" /> Изменить
            </div>
            <input ref="coverInputRef" type="file" accept="image/*" hidden @change="onCoverChange">
          </div>

          <div class="action-buttons">
            <KitBtn color="primary" class="full-width" @click="startReading">
              {{ (store.currentBookInfo.currentPage || 1) > 1 ? 'Продолжить чтение' : 'Начать чтение' }}
            </KitBtn>
            <KitBtn
              v-if="!store.currentBookInfo.stats && !store.isAnalyzingBook"
              variant="outlined"
              color="accent"
              class="full-width mt-2"
              @click="triggerAiAnalysis"
            >
              Сгенерировать AI Инфо
            </KitBtn>
          </div>
        </div>

        <div class="content-col">
          <h1 class="book-title">
            {{ store.currentBookInfo.title }}
          </h1>
          <p class="book-author">
            {{ store.currentBookInfo.author || 'Автор не указан' }}
          </p>

          <div class="progress-section">
            <div class="progress-text">
              Прогресс: Страница {{ store.currentBookInfo.currentPage || 1 }} из {{ formatNumber(store.currentBookInfo.totalPages) }}
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${((store.currentBookInfo.currentPage || 1) / store.currentBookInfo.totalPages) * 100}%` }"
              />
            </div>
          </div>

          <div v-if="store.isAnalyzingBook" class="ai-analysis-box is-loading">
            <Icon icon="mdi:robot-outline" class="spin-icon" />
            <p>Нейросеть анализирует текст книги...</p>
            <p class="sub-text">
              Это займет несколько секунд. Мы считаем иероглифы и оцениваем сложность.
            </p>
          </div>

          <div v-else class="ai-analysis-box">
            <div class="box-header">
              <h3>Информация</h3>
              <KitBtn
                v-if="!isEditingStats"
                icon="mdi:pencil"
                variant="text"
                size="sm"
                color="secondary"
                @click="startEditingStats"
              />
            </div>

            <template v-if="isEditingStats">
              <div class="edit-form">
                <div class="form-group">
                  <label>Сложность (HSK и т.д.)</label>
                  <KitInput v-model="editForm.difficulty" placeholder="Например: HSK 4" />
                </div>
                <div class="form-group">
                  <label>Теги (через запятую)</label>
                  <KitInput v-model="editForm.tags" placeholder="Фэнтези, Повседневность" />
                </div>
                <div class="form-group">
                  <label>Аннотация</label>
                  <textarea v-model="editForm.description" class="custom-textarea" rows="4" placeholder="О чем эта книга..." />
                </div>
                <div class="form-actions">
                  <KitBtn variant="tonal" @click="isEditingStats = false">
                    Отмена
                  </KitBtn>
                  <KitBtn color="primary" @click="saveStats">
                    Сохранить
                  </KitBtn>
                </div>
              </div>
            </template>

            <template v-else-if="store.currentBookInfo.stats">
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">Сложность</span>
                  <span class="stat-value difficulty-badge">{{ store.currentBookInfo.stats.difficulty || '?' }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Всего символов</span>
                  <span class="stat-value">{{ formatNumber(store.currentBookInfo.stats.totalChars) }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Уник. символов</span>
                  <span class="stat-value text-accent">{{ formatNumber(store.currentBookInfo.stats.uniqueChars) }}</span>
                </div>
              </div>

              <div v-if="store.currentBookInfo.stats.tags?.length" class="tags-list">
                <span v-for="tag in store.currentBookInfo.stats.tags" :key="tag" class="tag-badge">{{ tag }}</span>
              </div>

              <div class="book-description">
                <p>{{ store.currentBookInfo.stats.description || 'Описание пока не добавлено.' }}</p>
              </div>
            </template>

            <template v-else>
              <div class="empty-stats">
                <p>Информация о книге отсутствует. Вы можете добавить её вручную или сгенерировать с помощью ИИ.</p>
                <KitBtn variant="outlined" color="primary" @click="startEditingStats">
                  Добавить вручную
                </KitBtn>
              </div>
            </template>
          </div>

          <div v-if="store.currentBookInfo.toc && store.currentBookInfo.toc.length > 0" class="toc-section">
            <h3>Оглавление</h3>
            <div class="toc-list">
              <div
                v-for="item in store.currentBookInfo.toc"
                :key="item.id"
                class="toc-item"
                :style="{ paddingLeft: `${(item.level - 1) * 16}px` }"
                @click="goToPage(item.pageNum)"
              >
                <span class="toc-title">{{ item.title }}</span>
                <span class="toc-dots" />
                <span class="toc-page">{{ item.pageNum || '-' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.book-info-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
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
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }
}

.layout-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 40px;

  @include media-down(md) {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

.cover-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  background-color: var(--bg-tertiary-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
  margin-bottom: 24px;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-muted-color);
    .placeholder-icon {
      font-size: 5rem;
    }
  }

  .cover-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 500;
    opacity: 0;
    transition: opacity 0.2s;

    .mr-1 {
      margin-right: 6px;
    }
  }

  &:hover {
    img {
      transform: scale(1.05);
    }
    .cover-overlay {
      opacity: 1;
    }
  }
}

.action-buttons {
  .full-width {
    width: 100%;
  }
  .mt-2 {
    margin-top: 12px;
  }
}

.content-col {
  .book-title {
    font-size: 2.2rem;
    line-height: 1.2;
    margin: 0 0 8px 0;
    color: var(--fg-primary-color);
  }

  .book-author {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
    margin: 0 0 24px 0;
  }
}

.progress-section {
  background-color: var(--bg-secondary-color);
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;

  .progress-text {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    margin-bottom: 8px;
    font-weight: 500;
  }

  .progress-bar {
    height: 6px;
    background-color: var(--bg-tertiary-color);
    border-radius: 3px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      transition: width 0.3s ease;
    }
  }
}

.ai-analysis-box {
  background-color: rgba(var(--bg-accent-color-rgb, 48, 33, 61), 0.3);
  border: 1px solid var(--border-accent-color);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;

  .box-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
      font-size: 1.2rem;
      color: var(--fg-accent-color);
      margin: 0;
    }
  }

  &.is-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 40px 24px;

    .spin-icon {
      font-size: 3rem;
      color: var(--fg-accent-color);
      animation: pulse 1.5s infinite;
      margin-bottom: 16px;
    }

    p {
      margin: 0 0 8px 0;
      font-size: 1.1rem;
      font-weight: 500;
    }
    .sub-text {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
    }
  }

  .empty-stats {
    text-align: center;
    color: var(--fg-secondary-color);
    padding: 16px 0;

    p {
      margin-bottom: 16px;
    }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;

    @include media-down(sm) {
      grid-template-columns: 1fr;
    }

    .stat-item {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .stat-label {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .stat-value {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--fg-primary-color);

        &.text-accent {
          color: var(--fg-accent-color);
        }
        &.difficulty-badge {
          display: inline-block;
          background-color: var(--bg-highlight-color);
          color: var(--fg-highlight-color);
          font-size: 1.1rem;
          padding: 2px 10px;
          border-radius: 6px;
          width: fit-content;
        }
      }
    }
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;

    .tag-badge {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
      padding: 4px 12px;
      border-radius: 99px;
      font-size: 0.85rem;
      font-weight: 500;
    }
  }

  .book-description {
    p {
      margin: 0;
      line-height: 1.6;
      font-size: 0.95rem;
      color: var(--fg-primary-color);
      white-space: pre-wrap;
    }
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 0.9rem;
        color: var(--fg-secondary-color);
      }
    }

    .custom-textarea {
      width: 100%;
      background-color: var(--bg-primary-color);
      color: var(--fg-primary-color);
      border: 1px solid var(--border-primary-color);
      border-radius: 6px;
      padding: 10px 12px;
      font-family: inherit;
      font-size: 0.95rem;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;

      &:focus {
        border-color: var(--fg-accent-color);
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 8px;
    }
  }
}

.toc-section {
  h3 {
    font-size: 1.4rem;
    margin: 0 0 16px 0;
    color: var(--fg-primary-color);
    border-bottom: 1px solid var(--border-secondary-color);
    padding-bottom: 8px;
  }

  .toc-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .toc-item {
    display: flex;
    align-items: flex-end;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    transition:
      background-color 0.2s,
      color 0.2s;
    color: var(--fg-secondary-color);

    &:hover {
      background-color: var(--bg-secondary-color);
      color: var(--fg-primary-color);

      .toc-page {
        color: var(--fg-accent-color);
        font-weight: 600;
      }
    }

    .toc-title {
      flex-shrink: 0;
      font-size: 0.95rem;
    }

    .toc-dots {
      flex-grow: 1;
      border-bottom: 1px dotted var(--border-secondary-color);
      margin: 0 12px 5px 12px;
      opacity: 0.5;
    }

    .toc-page {
      flex-shrink: 0;
      font-size: 0.9rem;
      transition: color 0.2s;
    }
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
