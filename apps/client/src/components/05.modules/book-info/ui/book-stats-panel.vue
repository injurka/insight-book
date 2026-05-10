<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { reactive, ref } from 'vue'
import { KitBtn, KitInput } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()
const toast = useToast()

const isEditingStats = ref(false)

const editForm = reactive({
  difficulty: '',
  tags: '',
  description: '',
})

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null)
    return '0'
  return new Intl.NumberFormat('ru-RU').format(num)
}

function startEditingStats() {
  const stats = store.currentBookInfo?.stats
  editForm.difficulty = stats?.difficulty || ''
  editForm.tags = stats?.tags?.join(', ') || ''
  editForm.description = stats?.description || ''
  isEditingStats.value = true
}

async function triggerAiAnalysis() {
  if (!store.currentBookInfo) return
  try {
    await store.analyzeFullBook(store.currentBookInfo.id)
    isEditingStats.value = false
    toast.success('Нейросеть успешно завершила анализ!')
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка ИИ анализа')
  }
}

async function triggerVocabularyAnalysis() {
  if (!store.currentBookInfo) return
  try {
    await store.analyzeVocabulary(store.currentBookInfo.id)
    isEditingStats.value = false
    toast.success('Лексический профиль составлен!')
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка анализа лексики')
  }
}

async function saveStats() {
  if (!store.currentBookInfo) return
  try {
    const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    await store.updateBookStats(store.currentBookInfo.id, {
      difficulty: editForm.difficulty,
      tags: tagsArray,
      description: editForm.description,
    })
    isEditingStats.value = false
    toast.success('Информация о книге обновлена')
  }
  catch (e: any) {
    toast.error(e.message || 'Не удалось сохранить информацию')
  }
}
</script>

<template>
  <div v-if="store.currentBookInfo">
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
      <Icon icon="mdi:robot-outline" class="spin-icon pulse" />
      <p>Нейросеть анализирует текст книги...</p>
      <p class="sub-text">
        Это займет несколько секунд. Мы считаем иероглифы и оцениваем сложность.
      </p>
    </div>

    <div v-else class="ai-analysis-box">
      <div class="box-header">
        <h3>Информация</h3>
        <KitBtn v-if="!isEditingStats" icon="mdi:pencil" variant="text" size="sm" color="secondary" @click="startEditingStats" />
      </div>

      <template v-if="isEditingStats">
        <div class="edit-form">
          <div class="ai-generate-actions">
            <KitBtn
              variant="outlined"
              color="accent"
              icon="mdi:robot-outline"
              class="flex-1"
              :disabled="store.isAnalyzingBook"
              @click="triggerAiAnalysis"
            >
              Сгенерировать AI Инфо
            </KitBtn>
            <KitBtn
              variant="outlined"
              color="secondary"
              icon="mdi:chart-pie"
              class="flex-1"
              :disabled="store.isAnalyzingVocab"
              @click="triggerVocabularyAnalysis"
            >
              Собрать лексику
            </KitBtn>
          </div>

          <div class="edit-divider">
            <span>Или заполните вручную</span>
          </div>

          <div class="form-group">
            <label>Сложность</label>
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
          <p>Информация о книге отсутствует.</p>
          <KitBtn variant="outlined" color="primary" @click="startEditingStats">
            Добавить вручную или сгенерировать
          </KitBtn>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
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
      margin-bottom: 16px;
      &.pulse {
        animation: pulse 1.5s infinite;
      }
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
        font-weight: 600;
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

  .book-description p {
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

  .ai-generate-actions {
    display: flex;
    gap: 12px;

    @include media-down(sm) {
      flex-direction: column;
    }

    .flex-1 {
      flex: 1;
    }
  }

  .edit-divider {
    display: flex;
    align-items: center;
    text-align: center;
    color: var(--fg-muted-color);
    font-size: 0.85rem;
    margin: 8px 0;

    &::before,
    &::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid var(--border-primary-color);
    }

    &:not(:empty)::before {
      margin-right: 0.5em;
    }
    &:not(:empty)::after {
      margin-left: 0.5em;
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
  }

  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
