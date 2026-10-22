<script setup lang="ts">
import type { Book } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatNumber } from '../../lib/formatters'

interface Props {
  book?: Book | null
  preloadedCount?: number
  ttsFromCache?: number
}

const props = withDefaults(defineProps<Props>(), {
  book: null,
  preloadedCount: 0,
  ttsFromCache: 0,
})

const { t } = useI18n()

const cachedWords = computed(() => props.book?.cachedWords ?? 0)
const totalWords = computed(() => props.book?.stats?.totalWords)

const cachedSentences = computed(() => props.book?.cachedSentences ?? 0)
const totalSentences = computed(() => props.book?.stats?.totalSentences)

const cachedTts = computed(() => {
  const serverTts = props.book?.cachedTts ?? 0

  return Math.max(serverTts, props.ttsFromCache)
})

const generalAnalyses = computed(() => {
  if (cachedWords.value > 0 || cachedSentences.value > 0)
    return 0

  return props.book?.analysesCount || props.preloadedCount || 0
})

const hasOverview = computed(() => {
  return (
    cachedWords.value > 0
    || cachedSentences.value > 0
    || generalAnalyses.value > 0
    || cachedTts.value > 0
    || props.preloadedCount > 0
    || !!totalWords.value
    || !!totalSentences.value
  )
})
</script>

<template>
  <div v-if="hasOverview" class="cache-overview-card">
    <div class="overview-header">
      <div class="header-left">
        <Icon icon="mdi:database-outline" class="header-icon" />
        <div class="header-copy">
          <span class="header-title">{{ t('bookInfo.cacheBaseTitle') }}</span>
          <span class="header-description">{{ t('bookInfo.cacheOverviewScope') }}</span>
        </div>
      </div>
    </div>

    <div class="overview-grid">
      <!-- Слова -->
      <div v-if="cachedWords > 0 || totalWords" class="overview-metric">
        <div class="metric-icon-wrap words">
          <Icon icon="mdi:format-text" />
        </div>
        <div class="metric-content">
          <span class="metric-label">{{ t('bookInfo.cachedWords') }}</span>
          <span class="metric-value">
            <b>{{ formatNumber(cachedWords) }}</b>
            <span v-if="totalWords" class="metric-total">/ ~{{ formatNumber(totalWords) }}</span>
          </span>
        </div>
      </div>

      <!-- Предложения -->
      <div v-if="cachedSentences > 0 || totalSentences" class="overview-metric">
        <div class="metric-icon-wrap sentences">
          <Icon icon="mdi:brain" />
        </div>
        <div class="metric-content">
          <span class="metric-label">{{ t('bookInfo.cachedSentences') }}</span>
          <span class="metric-value">
            <b>{{ formatNumber(cachedSentences) }}</b>
            <span v-if="totalSentences" class="metric-total">/ ~{{ formatNumber(totalSentences) }}</span>
          </span>
        </div>
      </div>

      <!-- Озвучка TTS -->
      <div v-if="cachedTts > 0" class="overview-metric">
        <div class="metric-icon-wrap tts">
          <Icon icon="mdi:headphones" />
        </div>
        <div class="metric-content">
          <span class="metric-label">{{ t('bookInfo.cachedTts') }}</span>
          <span class="metric-value">
            <b>{{ formatNumber(cachedTts) }}</b>
          </span>
        </div>
      </div>

      <!-- Общие анализы (если нет раздельного подсчёта слов/предложений) -->
      <div v-if="generalAnalyses > 0" class="overview-metric">
        <div class="metric-icon-wrap general">
          <Icon icon="mdi:database-check-outline" />
        </div>
        <div class="metric-content">
          <span class="metric-label">{{ t('bookInfo.cachedAnalyses') }}</span>
          <span class="metric-value">
            <b>{{ formatNumber(generalAnalyses) }}</b>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cache-overview-card {
  background: var(--bg-secondary-color);
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  .overview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .header-left {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--fg-primary-color);

      .header-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }

      .header-title {
        font-size: 0.88rem;
        font-weight: 600;
      }

      .header-description {
        color: var(--fg-secondary-color);
        font-size: 0.7rem;
        line-height: 1.3;
      }

      .header-icon {
        font-size: 1.1rem;
        color: var(--fg-accent-color);
        flex-shrink: 0;
      }
    }
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
    gap: 8px;

    .overview-metric {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: color-mix(in srgb, var(--bg-tertiary-color) 60%, transparent);
      border: 1px solid var(--border-secondary-color);
      border-radius: 8px;
      min-width: 0;

      .metric-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        flex-shrink: 0;
        font-size: 1rem;

        &.words {
          color: var(--fg-accent-color);
          background: color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
        }

        &.sentences {
          color: var(--fg-accent-color);
          background: color-mix(in srgb, var(--fg-accent-color) 12%, transparent);
        }

        &.tts {
          color: var(--fg-info-color);
          background: color-mix(in srgb, var(--fg-info-color) 12%, transparent);
        }

        &.general {
          color: var(--fg-success-color);
          background: color-mix(in srgb, var(--fg-success-color) 12%, transparent);
        }
      }

      .metric-content {
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;

        .metric-label {
          font-size: 0.72rem;
          color: var(--fg-secondary-color);
          line-height: 1.25;
        }

        .metric-value {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 2px 5px;
          font-size: 0.82rem;
          color: var(--fg-primary-color);
          font-variant-numeric: tabular-nums;
          overflow-wrap: anywhere;

          b {
            font-weight: 600;
          }

          .metric-total {
            color: var(--fg-secondary-color);
            font-size: 0.75rem;
          }
        }
      }
    }
  }
}
</style>
