<script setup lang="ts">
import type { AnalyticsDailyPoint } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { formatDuration } from '~/03.domain/user'

type TrendMetric = 'activeUsers' | 'activeSeconds' | 'actions'

interface Props {
  points: AnalyticsDailyPoint[]
}

const props = defineProps<Props>()

const metric = ref<TrendMetric>('activeUsers')
const hoveredIndex = ref<number | null>(null)

const metricTabs: Array<{ value: TrendMetric, label: string }> = [
  { value: 'activeUsers', label: 'Активные юзеры' },
  { value: 'activeSeconds', label: 'Время на сайте' },
  { value: 'actions', label: 'Страницы и слова' },
]

function getPointValue(p: AnalyticsDailyPoint, m: TrendMetric): number {
  if (m === 'activeUsers')
    return p.activeUsers
  if (m === 'activeSeconds')
    return p.activeSeconds

  return p.pagesRead + p.wordsAdded + p.wordsReviewed
}

const maxValue = computed(() => {
  let max = 0

  for (const p of props.points) {
    const v = getPointValue(p, metric.value)
    if (v > max)
      max = v
  }

  return max
})

const bars = computed(() =>
  props.points.map((point, index) => {
    const val = getPointValue(point, metric.value)
    const heightPercent = maxValue.value > 0 ? Math.max((val / maxValue.value) * 100, val > 0 ? 4 : 0) : 0

    return {
      index,
      point,
      value: val,
      heightPercent,
    }
  }),
)

const activePoint = computed(() => {
  if (hoveredIndex.value !== null && props.points[hoveredIndex.value])
    return props.points[hoveredIndex.value]

  return props.points.length ? props.points[props.points.length - 1] : null
})

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')

  return `${d}.${m}`
}

const axisLabels = computed(() => {
  const len = props.points.length

  if (len === 0)
    return []

  if (len <= 7)
    return props.points.map(p => formatShortDate(p.date))

  const idxs = [0, Math.floor((len - 1) * 0.33), Math.floor((len - 1) * 0.66), len - 1]

  return idxs.map(i => formatShortDate(props.points[i].date))
})
</script>

<template>
  <section class="trend-card">
    <div class="trend-card__header">
      <div class="trend-card__title-wrap">
        <Icon icon="mdi:chart-bar" class="trend-card__icon" />
        <div>
          <h2 class="trend-card__title">
            Динамика по дням
          </h2>
          <p class="trend-card__subtitle">
            Наведите на столбец, чтобы увидеть детали дня
          </p>
        </div>
      </div>

      <div class="trend-tabs">
        <button
          v-for="tab in metricTabs"
          :key="tab.value"
          type="button"
          class="trend-tab"
          :class="{ 'trend-tab--active': metric === tab.value }"
          @click="metric = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div v-if="activePoint" class="trend-inspector">
      <span class="trend-inspector__date">{{ formatShortDate(activePoint.date) }}</span>
      <span class="trend-inspector__item">
        <Icon icon="mdi:account-check-outline" />
        {{ activePoint.activeUsers }} акт.
      </span>
      <span class="trend-inspector__item">
        <Icon icon="mdi:clock-outline" />
        {{ formatDuration(activePoint.activeSeconds) }}
      </span>
      <span class="trend-inspector__item">
        <Icon icon="mdi:book-open-page-variant-outline" />
        {{ activePoint.pagesRead }} стр.
      </span>
      <span class="trend-inspector__item">
        <Icon icon="mdi:cards-outline" />
        +{{ activePoint.wordsAdded }} / {{ activePoint.wordsReviewed }} повт.
      </span>
      <span v-if="activePoint.newUsers > 0" class="trend-inspector__item trend-inspector__item--accent">
        <Icon icon="mdi:account-plus-outline" />
        +{{ activePoint.newUsers }} нов.
      </span>
    </div>

    <div class="trend-chart" @mouseleave="hoveredIndex = null">
      <div
        v-for="bar in bars"
        :key="bar.point.date"
        class="trend-bar-col"
        :class="{ 'trend-bar-col--hovered': hoveredIndex === bar.index }"
        @mouseenter="hoveredIndex = bar.index"
      >
        <div
          class="trend-bar"
          :class="{
            'trend-bar--empty': bar.value === 0,
            'trend-bar--gold': metric === 'activeSeconds',
          }"
          :style="{ height: `${bar.heightPercent}%` }"
        />
      </div>
    </div>

    <div class="trend-axis">
      <span v-for="(label, idx) in axisLabels" :key="`${label}-${idx}`">
        {{ label }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.trend-card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.trend-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.trend-card__title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.trend-card__icon {
  font-size: 22px;
  color: var(--fg-accent-color, #4b8266);
  margin-top: 1px;
  flex-shrink: 0;
}

.trend-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
}

.trend-card__subtitle {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  margin: 3px 0 0;
}

.trend-tabs {
  display: inline-flex;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.trend-tab {
  border: none;
  background: transparent;
  color: var(--fg-secondary-color, #8e867b);
  font-size: 12px;
  font-weight: 500;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.trend-tab:hover {
  color: var(--fg-primary-color, #4a443c);
}

.trend-tab--active {
  background: var(--bg-secondary-color, #e8e2d9);
  color: var(--fg-primary-color, #4a443c);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(74, 68, 60, 0.08);
}

.trend-inspector {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 9px 14px;
  border-radius: 8px;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  font-size: 12.5px;
  color: var(--fg-primary-color, #4a443c);
}

.trend-inspector__date {
  font-weight: 700;
  color: var(--fg-accent-color, #4b8266);
  padding-right: 4px;
  border-right: 1px solid var(--border-primary-color, #c7c0b6);
}

.trend-inspector__item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--fg-secondary-color, #8e867b);
}

.trend-inspector__item--accent {
  color: var(--fg-accent-color, #4b8266);
  font-weight: 600;
}

.trend-chart {
  height: 170px;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  padding: 12px 6px 0;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
  background: linear-gradient(
    to top,
    transparent 0%,
    transparent 33%,
    rgba(199, 192, 182, 0.25) 33%,
    rgba(199, 192, 182, 0.25) 33.6%,
    transparent 33.6%,
    transparent 66%,
    rgba(199, 192, 182, 0.25) 66%,
    rgba(199, 192, 182, 0.25) 66.6%,
    transparent 66.6%
  );
}

.trend-bar-col {
  flex: 1 1 0;
  min-width: 3px;
  height: 100%;
  display: flex;
  align-items: flex-end;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  transition: background 0.12s;
}

.trend-bar-col--hovered {
  background: rgba(75, 130, 102, 0.1);
}

.trend-bar {
  width: 100%;
  border-radius: 4px 4px 0 0;
  background: var(--fg-accent-color, #4b8266);
  transition:
    height 0.25s ease,
    opacity 0.15s;
}

.trend-bar--gold {
  background: var(--fg-highlight-color, #c2a14d);
}

.trend-bar--empty {
  height: 2px !important;
  background: var(--border-primary-color, #c7c0b6);
  opacity: 0.45;
}

.trend-axis {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--fg-secondary-color, #8e867b);
  padding: 0 4px;
}
</style>
