<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitDropdown } from '~/02.kit/molecules/kit-dropdown/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { formatNumber } from '../lib/formatters'

const libraryStore = useLibraryStore()
const { t, locale } = useI18n()
const detailsId = useId()
const trigger = useTemplateRef<InstanceType<typeof KitBtn>>('trigger')

const showCrowdsource = ref(false)

const metrics = computed(() => {
  const {
    totalPages = 0,
    analysesCount = 0,
    cachedSentences = 0,
    cachedWords = 0,
    cachedTts = 0,
    stats,
  } = libraryStore.currentBookInfo ?? {}
  const { totalSentences = 0, totalWords = 0 } = stats ?? {}

  return [
    {
      key: 'pages',
      icon: 'mdi:file-check-outline',
      label: t('bookStats.analyzedPages'),
      count: analysesCount,
      total: totalPages,
    },
    {
      key: 'sentences',
      icon: 'mdi:message-text-outline',
      label: t('translatedSentences'),
      count: cachedSentences,
      total: totalSentences,
    },
    {
      key: 'words',
      icon: 'mdi:book-alphabet',
      label: t('translatedWords'),
      count: cachedWords,
      total: totalWords,
    },
    {
      key: 'tts',
      icon: 'mdi:volume-high',
      label: t('voicedTts'),
      count: cachedTts,
      total: (totalSentences) + (totalWords),
    },
  ].filter(metric => metric.key !== 'pages' || metric.total > 0).map(metric => ({
    ...metric,
    percent: metric.total > 0 ? Math.min(100, Math.max(0, metric.count / metric.total * 100)) : null,
    complete: metric.total > 0 && metric.count >= metric.total,
  }))
})

watch(showCrowdsource, async (isOpen, wasOpen) => {
  if (!isOpen && wasOpen) {
    await nextTick()
    trigger.value?.$el.focus()
  }
})

function formatPercent(value: number) {
  const formatter = new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 })

  return value > 0 && value < 0.1 ? `<${formatter.format(0.1)}%` : `${formatter.format(value)}%`
}
</script>

<template>
  <KitDropdown
    v-if="libraryStore.currentBookInfo?.stats?.totalSentences || libraryStore.currentBookInfo?.totalPages"
    v-model="showCrowdsource"
    placement="bottom-end"
    width="min(360px, calc(100vw - 24px))"
    :close-on-content-click="false"
  >
    <template #activator>
      <KitTooltip :text="t('globalAiCache')" placement="top">
        <KitBtn
          ref="trigger"
          class="translation-trigger"
          variant="text"
          size="sm"
          icon="mdi:earth"
          :aria-label="t('globalAiCache')"
          :aria-expanded="showCrowdsource"
          :aria-controls="showCrowdsource ? detailsId : undefined"
        />
      </KitTooltip>
    </template>
    <section :id="detailsId" class="translation-popover" :aria-labelledby="`${detailsId}-title`">
      <div class="popover-header">
        <h3 :id="`${detailsId}-title`">
          {{ t('globalAiCache') }}
        </h3>
        <KitBtn
          variant="text"
          size="sm"
          icon="mdi:close"
          :aria-label="t('kit.dialog.close')"
          @click="showCrowdsource = false"
        />
      </div>
      <div class="crowdsource-list">
        <div
          v-for="metric in metrics"
          :key="metric.key"
          class="cs-card"
          :class="[`cs-card--${metric.key}`, { 'is-complete': metric.complete }]"
        >
          <div class="cs-card-header">
            <div class="cs-icon-wrap">
              <Icon :icon="metric.icon" />
            </div>
            <div class="cs-meta">
              <span class="cs-label">{{ metric.label }}</span>
              <span class="cs-value">
                <b>{{ formatNumber(metric.count) }}</b>
                <span v-if="metric.total > 0" class="cs-total"> / {{ formatNumber(metric.total) }}</span>
              </span>
            </div>
            <span v-if="metric.percent !== null" class="cs-badge">{{ formatPercent(metric.percent) }}</span>
          </div>
          <div v-if="metric.percent !== null" class="cs-progress">
            <div class="cs-fill" :style="{ width: `${metric.percent}%` }" />
          </div>
        </div>
      </div>
    </section>
  </KitDropdown>
</template>

<style lang="scss" scoped>
.translation-trigger {
  color: var(--fg-secondary-color);

  &:hover,
  &[aria-expanded='true'] {
    color: var(--fg-primary-color);
  }

  @media (pointer: coarse) {
    width: 44px;
    height: 44px;
  }
}
.translation-popover {
  padding: 4px;
  max-height: min(480px, calc(100dvh - 32px));
  overflow-y: auto;
}
.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;

  h3 {
    font-size: 0.95rem;
    line-height: 1.4;
    margin: 0;
    font-weight: 600;
  }
}
.crowdsource-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cs-card {
  --metric-color: var(--fg-info-color);

  &--sentences {
    --metric-color: var(--fg-accent-color);
  }
  &--words {
    --metric-color: var(--fg-success-color);
  }
  &--tts {
    --metric-color: var(--fg-warning-color);
  }

  padding: 14px 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--metric-color) 3%, var(--bg-secondary-color));
  border: 1px solid var(--border-primary-color);

  &.is-complete {
    border-color: color-mix(in srgb, var(--fg-success-color) 35%, transparent);

    .cs-icon-wrap,
    .cs-badge {
      background: color-mix(in srgb, var(--fg-success-color) 15%, transparent);
      color: var(--fg-success-color);
    }

    .cs-fill {
      background: var(--fg-success-color);
    }
  }
}
.cs-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cs-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--metric-color) 12%, var(--bg-secondary-color));
  color: var(--metric-color);
  font-size: 1.25rem;
}
.cs-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cs-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--fg-muted-color);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.cs-value {
  color: var(--fg-primary-color);
  line-height: 1.3;
  font-variant-numeric: tabular-nums;

  b {
    font-size: 1.1rem;
    font-weight: 600;
  }
}
.cs-total {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  white-space: nowrap;
}
.cs-badge {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--metric-color) 12%, var(--bg-secondary-color));
  color: var(--metric-color);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.cs-progress {
  height: 4px;
  margin-top: 10px;
  background: var(--bg-tertiary-color);
  border-radius: 99px;
  overflow: hidden;
}
.cs-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--metric-color);
  transition: width 0.3s ease;
}
@media (prefers-reduced-motion: reduce) {
  .cs-fill {
    transition: none;
  }
}
</style>
