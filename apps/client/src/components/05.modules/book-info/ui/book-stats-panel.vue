<script setup lang="ts">
import type { TagKey } from '~/shared/constants/tags'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDropdown, KitInput, KitSelect, KitTooltip } from '~/components/01.kit'
import { BookEntity } from '~/components/03.domain/entities/book.entity'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { BOOK_TAGS } from '~/shared/constants/tags'
import { useAuthStore } from '~/shared/store/auth.store'
import { useCacheStore } from '~/shared/store/cache.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useBookStatsEdit } from '../composables/use-book-stats-edit'
import { formatNumber } from '../lib/formatters'
import CachePopover from './CachePopover.vue'

const libraryStore = useLibraryStore()
const cacheStore = useCacheStore()
const authStore = useAuthStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()

const isEditingStats = defineModel<boolean>('isEditing', { default: false })
const showCrowdsource = ref(false)

const {
  editForm,
  editDescLang,
  currentDescription,
  currentDifficultyOptions,
  difficultyLevelClass,
  saveStats,
  triggerAiAnalysis,
  triggerVocabularyAnalysis,
} = useBookStatsEdit(isEditingStats)

const bookCacheStats = computed(() => {
  if (!cacheStore.stats || !libraryStore.currentBookInfo)
    return null

  return cacheStore.stats.bookStats[libraryStore.currentBookInfo.id] || { cachedPages: [], analysesCount: 0, sizeBytes: 0 }
})

const bookDescription = computed(() => {
  return currentDescription.value
})

const progressPercent = computed(() => {
  if (!libraryStore.currentBookInfo)
    return 0

  const entity = new BookEntity(libraryStore.currentBookInfo)

  return entity.getProgressPercent()
})

const localizedTags = computed(() => {
  const tags = libraryStore.currentBookInfo?.stats?.tags || []

  return tags.map((tag: string) => {
    return BOOK_TAGS[tag as TagKey]?.[settingsStore.appLanguage as keyof (typeof BOOK_TAGS)[TagKey]] || tag
  })
})

watch(() => libraryStore.syncState, (val) => {
  if (val === 'finished') {
    cacheStore.loadStats()
    // После успешной синхронизации (которая могла перевести фразы) обновляем текущую инфу о книге
    if (libraryStore.currentBookInfo) {
      libraryStore.fetchBookInfo(libraryStore.currentBookInfo.id)
    }
  }
})

function percent(part: number | undefined, total: number | undefined) {
  if (!total || total === 0)
    return '0%'
  const p = Math.round(((part || 0) / total) * 100)
  return `${Math.min(100, Math.max(0, p))}%`
}

onMounted(() => {
  cacheStore.loadStats()
})
</script>

<template>
  <div v-if="libraryStore.currentBookInfo">
    <h1 class="book-title">
      {{ libraryStore.currentBookInfo.title }}
    </h1>
    <p class="book-author">
      {{ libraryStore.currentBookInfo.author || t('bookStats.authorNotSpecified') }}
    </p>

    <div class="progress-section">
      <div class="progress-header">
        <div class="progress-text">
          {{ t('bookStats.progressPage') }} {{ libraryStore.currentBookInfo.currentPage || 1 }} {{ t('bookStats.outOf') }} {{ formatNumber(libraryStore.currentBookInfo.totalPages) }}
        </div>
        <KitDropdown placement="bottom-end" width="300px">
          <template #activator="{ props: slotProps }">
            <KitTooltip :text="t('bookStats.inCache')" placement="top">
              <button class="cache-trigger-btn" :class="{ 'is-active': slotProps.isOpen, 'is-loaded': bookCacheStats !== null }">
                <Icon icon="mdi:cloud-outline" />
              </button>
            </KitTooltip>
          </template>

          <CachePopover />
        </KitDropdown>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }" />
      </div>
    </div>

    <div v-if="libraryStore.isAnalyzingBook" class="ai-analysis-box is-loading">
      <Icon icon="mdi:robot-outline" class="spin-icon pulse" />
      <p>{{ t('bookStats.aiAnalyzing') }}</p>
      <p class="sub-text">
        {{ t('bookStats.takesFewSeconds') }}
      </p>
    </div>

    <div v-else class="ai-analysis-box">
      <div class="box-header">
        <h3>{{ t('bookStats.info') }}</h3>
      </div>

      <template v-if="isEditingStats && libraryStore.currentBookInfo.userId === authStore.user?.id">
        <div class="edit-form">
          <div class="ai-generate-actions">
            <KitBtn variant="outlined" color="accent" icon="mdi:robot-outline" class="flex-1" :disabled="libraryStore.isAnalyzingBook" @click="triggerAiAnalysis">
              {{ t('bookStats.generateAiInfo') }}
            </KitBtn>
            <KitBtn variant="outlined" color="secondary" icon="mdi:chart-pie" class="flex-1" :disabled="libraryStore.isAnalyzingVocab" @click="triggerVocabularyAnalysis">
              {{ t('bookStats.collectVocab') }}
            </KitBtn>
          </div>
          <div class="edit-divider">
            <span>{{ t('bookStats.fillManually') }}</span>
          </div>
          <div class="form-group">
            <label>{{ t('bookStats.difficulty') }}</label>
            <KitSelect v-model="editForm.difficulty" :options="currentDifficultyOptions" />
          </div>
          <div class="form-group">
            <label>{{ t('bookStats.tagsComma') }}</label>
            <KitInput v-model="editForm.tags" :placeholder="t('dictionary.tagsComma')" />
          </div>
          <div class="form-group">
            <label>{{ t('bookStats.annotation') }}</label>
            <textarea v-model="editForm.descriptionByLang[editDescLang]" class="custom-textarea" rows="4" :placeholder="t('bookStats.annotation')" />
          </div>
          <div class="form-actions">
            <KitBtn variant="tonal" @click="isEditingStats = false">
              {{ t('bookStats.cancel') }}
            </KitBtn>
            <KitBtn color="primary" @click="saveStats">
              {{ t('bookStats.save') }}
            </KitBtn>
          </div>
        </div>
      </template>

      <template v-else-if="libraryStore.currentBookInfo.stats">
        <div class="stats-grid" :class="{ 'single-col': libraryStore.currentBookInfo.type === 'manga' }">
          <div class="stat-item">
            <span class="stat-label">{{ t('bookStats.difficulty') }}</span>
            <span class="stat-value difficulty-badge" :class="difficultyLevelClass">
              {{ libraryStore.currentBookInfo.stats.difficulty || '?' }}
            </span>
          </div>
          <template v-if="libraryStore.currentBookInfo.type !== 'manga'">
            <div class="stat-item">
              <span class="stat-label">{{ t('bookStats.totalChars') }}</span>
              <span class="stat-value">{{ formatNumber(libraryStore.currentBookInfo.stats.totalChars) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">{{ t('bookStats.uniqueChars') }}</span>
              <span class="stat-value text-accent">{{ formatNumber(libraryStore.currentBookInfo.stats.uniqueChars) }}</span>
            </div>
          </template>
        </div>
        <div v-if="localizedTags.length" class="tags-list">
          <span v-for="tag in localizedTags" :key="tag" class="tag-badge">{{ tag }}</span>
        </div>
        <div class="book-description">
          <p>{{ bookDescription }}</p>
        </div>

        <div v-if="libraryStore.currentBookInfo.stats.totalSentences || libraryStore.currentBookInfo.type === 'manga'" class="crowdsource-section">
          <div class="cs-box-header" @click="showCrowdsource = !showCrowdsource">
            <h3><Icon icon="mdi:earth" /> {{ t('globalAiCache') }}</h3>
            <Icon :icon="showCrowdsource ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="cs-toggle-icon" />
          </div>
          <Transition name="fade-slide">
            <div v-show="showCrowdsource" class="crowdsource-list">
              <!-- Страницы (для манги) -->
              <div v-if="libraryStore.currentBookInfo.type === 'manga'" class="cs-item">
                <div class="cs-info">
                  <span><Icon icon="mdi:file-document-outline" /> {{ t('bookStats.analyzedPages') || 'Проанализировано страниц' }}</span>
                  <span>{{ formatNumber(libraryStore.currentBookInfo.analysesCount) }} / {{ formatNumber(libraryStore.currentBookInfo.totalPages) }}</span>
                </div>
                <div class="cs-bar">
                  <div class="cs-fill" :style="{ width: percent(libraryStore.currentBookInfo.analysesCount, libraryStore.currentBookInfo.totalPages) }" />
                </div>
              </div>

              <!-- Предложения -->
              <div class="cs-item">
                <div class="cs-info">
                  <span><Icon icon="mdi:brain" /> {{ t('translatedSentences') }}</span>
                  <span v-if="libraryStore.currentBookInfo.type === 'manga'">{{ formatNumber(libraryStore.currentBookInfo.cachedSentences) }}</span>
                  <span v-else>{{ formatNumber(libraryStore.currentBookInfo.cachedSentences) }} / {{ formatNumber(libraryStore.currentBookInfo.stats.totalSentences) }}</span>
                </div>
                <div v-if="libraryStore.currentBookInfo.type !== 'manga'" class="cs-bar">
                  <div class="cs-fill" :style="{ width: percent(libraryStore.currentBookInfo.cachedSentences, libraryStore.currentBookInfo.stats.totalSentences) }" />
                </div>
              </div>
              <!-- Слова -->
              <div class="cs-item">
                <div class="cs-info">
                  <span><Icon icon="mdi:format-text" /> {{ t('translatedWords') }}</span>
                  <span v-if="libraryStore.currentBookInfo.type === 'manga'">{{ formatNumber(libraryStore.currentBookInfo.cachedWords) }}</span>
                  <span v-else>{{ formatNumber(libraryStore.currentBookInfo.cachedWords) }} / {{ formatNumber(libraryStore.currentBookInfo.stats.totalWords) }}</span>
                </div>
                <div v-if="libraryStore.currentBookInfo.type !== 'manga'" class="cs-bar">
                  <div class="cs-fill" :style="{ width: percent(libraryStore.currentBookInfo.cachedWords, libraryStore.currentBookInfo.stats.totalWords) }" />
                </div>
              </div>
              <!-- Озвучка -->
              <div class="cs-item">
                <div class="cs-info">
                  <span><Icon icon="mdi:headphones" /> {{ t('voicedTts') }}</span>
                  <span v-if="libraryStore.currentBookInfo.type === 'manga'">{{ formatNumber(libraryStore.currentBookInfo.cachedTts) }}</span>
                  <span v-else>{{ formatNumber(libraryStore.currentBookInfo.cachedTts) }} / {{ formatNumber((libraryStore.currentBookInfo.stats.totalSentences || 0) + (libraryStore.currentBookInfo.stats.totalWords || 0)) }}</span>
                </div>
                <div v-if="libraryStore.currentBookInfo.type !== 'manga'" class="cs-bar">
                  <div class="cs-fill tts" :style="{ width: percent(libraryStore.currentBookInfo.cachedTts, (libraryStore.currentBookInfo.stats.totalSentences || 0) + (libraryStore.currentBookInfo.stats.totalWords || 0)) }" />
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </template>

      <template v-else>
        <div class="empty-stats">
          <p>{{ t('bookStats.noBookInfo') }}</p>
          <KitBtn variant="outlined" color="primary" @click="isEditingStats = true">
            {{ t('bookStats.add') }}
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

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .progress-text {
    font-size: 0.95rem;
    color: var(--fg-primary-color);
    font-weight: 500;
  }

  .cache-trigger-btn {
    background: transparent;
    border: none;
    color: var(--fg-secondary-color);
    cursor: pointer;
    font-size: 1.2rem;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &.is-loaded {
      color: var(--fg-accent-color);
    }

    &:hover,
    &.is-active {
      color: var(--fg-primary-color);
      background-color: var(--bg-tertiary-color);
    }
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
  margin-bottom: 0;
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
    &.single-col {
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
          background-color: var(--bg-tertiary-color);
          color: var(--fg-primary-color);
          font-size: 1.1rem;
          padding: 2px 10px;
          border-radius: 6px;
          width: fit-content;

          &.level-easy {
            background-color: var(--bg-success-color);
            color: var(--fg-success-color);
          }
          &.level-medium {
            background-color: var(--bg-warning-color);
            color: var(--fg-warning-color);
          }
          &.level-hard {
            background-color: var(--bg-error-color);
            color: var(--fg-error-color);
          }
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
  .desc-lang-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    label {
      flex: 1;
    }
  }
  .form-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
}

.crowdsource-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-secondary-color);

  .cs-box-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
    padding: 10px 12px;
    margin: 0 -12px;
    border-radius: 8px;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--bg-tertiary-color);
    }

    h3 {
      font-size: 1rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;

      svg {
        color: var(--fg-secondary-color);
        font-size: 1.2rem;
      }
    }

    .cs-toggle-icon {
      font-size: 1.2rem;
      color: var(--fg-secondary-color);
    }
  }
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.crowdsource-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.cs-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .cs-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    span:first-child {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--fg-secondary-color);
      svg {
        font-size: 1.1em;
      }
    }
    span:last-child {
      font-variant-numeric: tabular-nums;
    }
  }

  .cs-bar {
    height: 6px;
    background-color: var(--bg-tertiary-color);
    border-radius: 3px;
    overflow: hidden;

    .cs-fill {
      height: 100%;
      background-color: var(--fg-accent-color);
      transition: width 0.3s ease;

      &.tts {
        background-color: var(--fg-info-color);
      }
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
