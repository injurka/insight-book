<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { KitBtn, KitInput, KitSkeleton } from '~/components/01.kit'
import WordPopover from '~/components/05.modules/reader/ui/word-popover.vue'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useBooksStore } from '~/shared/store/books.store'

const route = useRoute()
const router = useRouter()
const store = useBooksStore()
const toast = useToast()

const bookId = computed(() => Number(route.params.id))

const coverInputRef = ref<HTMLInputElement | null>(null)

const isEditingStats = ref(false)
const isLexicalExpanded = ref(false)
const isWordsExpanded = ref(false)

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

async function triggerAiAnalysis() {
  try {
    await store.analyzeFullBook(bookId.value)
    isEditingStats.value = false
    toast.success('Нейросеть успешно завершила анализ!')
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка ИИ анализа')
  }
}

async function triggerVocabularyAnalysis() {
  try {
    await store.analyzeVocabulary(bookId.value)
    isEditingStats.value = false
    isLexicalExpanded.value = true // Автоматически раскрываем профиль после генерации
    toast.success('Лексический профиль составлен!')
  }
  catch (e: any) {
    toast.error(e.message || 'Ошибка анализа лексики')
  }
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
  try {
    const tagsArray = editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
    await store.updateBookStats(bookId.value, {
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

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null)
    return '0'
  return new Intl.NumberFormat('ru-RU').format(num)
}

const posStats = computed(() => {
  const dist = store.currentBookInfo?.stats?.posDistribution
  if (!dist)
    return null

  let nouns = 0; let verbs = 0; let adjs = 0; let others = 0

  for (const [tag, count] of Object.entries(dist)) {
    if (tag.startsWith('n'))
      nouns += count
    else if (tag.startsWith('v'))
      verbs += count
    else if (tag.startsWith('a') || tag.startsWith('d'))
      adjs += count
    else others += count
  }

  const total = nouns + verbs + adjs + others

  if (total === 0)
    return null

  return {
    nouns: Math.round((nouns / total) * 100),
    verbs: Math.round((verbs / total) * 100),
    adjs: Math.round((adjs / total) * 100),
  }
})

watch(
  bookId,
  (newId) => {
    if (newId)
      store.fetchBookInfo(newId)
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
          <KitSkeleton width="80%" height="32px" class="title-skeleton" />
          <KitSkeleton width="40%" height="20px" class="author-skeleton" />
          <KitSkeleton width="100%" height="150px" border-radius="12px" />
        </div>
      </div>
    </div>

    <div v-else-if="store.currentBookInfo" class="book-container">
      <div class="layout-grid">
        <div class="cover-col">
          <div class="cover-wrapper group" @click="coverInputRef.value!.click()">
            <img v-if="store.currentBookInfo.coverBase64" :src="store.currentBookInfo.coverBase64" alt="Обложка">
            <div v-else class="cover-placeholder">
              <Icon icon="mdi:book-open-blank-variant" class="placeholder-icon" />
            </div>
            <div class="cover-overlay">
              <Icon icon="mdi:image-edit" /> Изменить
            </div>
            <input ref="coverInputRef" type="file" accept="image/*" hidden @change="onCoverChange">
          </div>

          <div class="action-buttons">
            <KitBtn color="primary" class="full-width" @click="startReading">
              {{ (store.currentBookInfo.currentPage || 1) > 1 ? 'Продолжить чтение' : 'Начать чтение' }}
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

          <!-- Блок Описания -->
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

          <!-- Блок Лексического профиля -->
          <div v-if="store.isAnalyzingVocab" class="ai-analysis-box is-loading">
            <Icon icon="mdi:loading" class="spin-icon" />
            <p>Изучаем словарный запас книги...</p>
            <p class="sub-text">
              Токенизация и подсчет частотности займут несколько секунд.
            </p>
          </div>

          <div v-else-if="store.currentBookInfo.stats?.topWords" class="ai-analysis-box lexical-box">
            <!-- Интерактивный заголовок -->
            <div class="box-header expandable-header" @click="isLexicalExpanded = !isLexicalExpanded">
              <div class="header-info">
                <h3><Icon icon="mdi:chart-arc" /> Лексический профиль</h3>
                <span class="diversity-inline">
                  <span class="dot-divider">•</span>
                  Разнообразие: <b class="diversity-value">{{ store.currentBookInfo.stats.lexicalDiversity }}%</b>
                </span>
              </div>
              <Icon :icon="isLexicalExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="header-chevron" />
            </div>

            <!-- Раскрывающееся содержимое -->
            <div v-show="isLexicalExpanded" class="lexical-expanded-content">
              <p class="lexical-description">
                Показатель разнообразия отражает процент уникальных слов в тексте. Чем он выше, тем сложнее лексика книги.
              </p>

              <div v-if="posStats" class="pos-container">
                <div class="pos-labels">
                  <span class="noun-dot">Существительные {{ posStats.nouns }}%</span>
                  <span class="verb-dot">Глаголы {{ posStats.verbs }}%</span>
                  <span class="adj-dot">Прил/Нареч {{ posStats.adjs }}%</span>
                </div>
                <div class="pos-bar">
                  <div class="pos-segment noun" :style="{ width: `${posStats.nouns}%` }" />
                  <div class="pos-segment verb" :style="{ width: `${posStats.verbs}%` }" />
                  <div class="pos-segment adj" :style="{ width: `${posStats.adjs}%` }" />
                </div>
              </div>

              <h4 class="top-words-title">
                Ядро книги:
              </h4>
              <div class="words-collapse-container" :class="{ 'is-expanded': isWordsExpanded }">
                <div class="top-words-cloud">
                  <div
                    v-for="word in store.currentBookInfo.stats.topWords"
                    :key="word.word"
                    class="word-chip"
                    :class="{
                      'chip-n': word.pos.startsWith('n'),
                      'chip-v': word.pos.startsWith('v'),
                      'chip-a': word.pos.startsWith('a') || word.pos.startsWith('d'),
                    }"
                  >
                    {{ word.word }} <span class="count">{{ word.count }}</span>
                  </div>
                </div>
                <div v-if="!isWordsExpanded" class="words-gradient-overlay" />
              </div>

              <KitBtn
                variant="text"
                size="sm"
                class="expand-btn"
                :icon="isWordsExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'"
                @click="isWordsExpanded = !isWordsExpanded"
              >
                {{ isWordsExpanded ? 'Свернуть' : 'Развернуть слова' }}
              </KitBtn>
            </div>
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

    <WordPopover />
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

.loading-state {
  .title-skeleton {
    margin-bottom: 16px;
  }
  .author-skeleton {
    margin-bottom: 16px;
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
  display: flex;
  flex-direction: column;
  gap: 12px;
  .full-width {
    width: 100%;
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

  &.lexical-box {
    background-color: var(--bg-secondary-color);
    border-color: var(--border-secondary-color);
    padding: 16px 24px;
    transition: border-color 0.2s;

    &:hover {
      border-color: var(--border-primary-color);
    }
  }

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
      &:not(.pulse) {
        animation: spin 1s linear infinite;
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

/* =========================================
   АККОРДЕОН ЛЕКСИКИ
   ========================================= */

.expandable-header {
  cursor: pointer;
  user-select: none;
  margin-bottom: 0 !important;

  &:hover {
    .header-info h3 {
      color: var(--fg-accent-color);
    }
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;

    h3 {
      transition: color 0.2s;
      color: var(--fg-primary-color);
    }
  }

  .diversity-inline {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    display: flex;
    align-items: center;
    gap: 8px;

    .dot-divider {
      opacity: 0.5;
      font-size: 1.2rem;
    }

    .diversity-value {
      color: var(--fg-accent-color);
      font-weight: 600;
      font-size: 1.05rem;
    }
  }

  .header-chevron {
    font-size: 1.5rem;
    color: var(--fg-secondary-color);
    transition: transform 0.3s;
  }
}

.lexical-expanded-content {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-secondary-color);
  animation: fade-in 0.3s ease;
}

.lexical-description {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  margin: 0 0 20px 0;
}

.pos-container {
  margin-bottom: 24px;

  .pos-labels {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
    font-size: 0.85rem;
    font-weight: 500;

    span {
      display: flex;
      align-items: center;
      gap: 6px;
      &::before {
        content: '';
        display: block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }
    }
    .noun-dot::before {
      background-color: #3b82f6;
    }
    .verb-dot::before {
      background-color: #ef4444;
    }
    .adj-dot::before {
      background-color: #10b981;
    }
  }

  .pos-bar {
    height: 10px;
    border-radius: 5px;
    display: flex;
    overflow: hidden;
    background-color: var(--bg-tertiary-color);

    .pos-segment {
      transition: width 0.5s ease-in-out;
    }
    .noun {
      background-color: #3b82f6;
    }
    .verb {
      background-color: #ef4444;
    }
    .adj {
      background-color: #10b981;
    }
  }
}

.top-words-title {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  color: var(--fg-primary-color);
}

.words-collapse-container {
  position: relative;
  max-height: 86px; // 2 строки чипов
  overflow: hidden;
  transition: max-height 0.3s ease-in-out;

  &.is-expanded {
    max-height: 1200px;
  }

  .words-gradient-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 46px;
    background: linear-gradient(
      to bottom,
      rgba(var(--bg-secondary-color-rgb), 0),
      rgba(var(--bg-secondary-color-rgb), 1)
    );
    pointer-events: none;
  }
}

.expand-btn {
  margin-top: 8px;
}

.top-words-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;

  .word-chip {
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-primary-color);
    color: var(--fg-primary-color);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 6px;

    .count {
      font-size: 0.75rem;
      background-color: var(--bg-tertiary-color);
      padding: 2px 6px;
      border-radius: 10px;
      color: var(--fg-secondary-color);
    }

    /* Статичные рамки для частей речи (без эффекта наведения) */
    &.chip-n {
      border-color: #3b82f6;
    }
    &.chip-v {
      border-color: #ef4444;
    }
    &.chip-a {
      border-color: #10b981;
    }
  }
}

/* =========================================
   ОСТАЛЬНОЕ
   ========================================= */

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
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
