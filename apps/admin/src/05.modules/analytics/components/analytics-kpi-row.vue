<script setup lang="ts">
import type { AdminAnalyticsOverview } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { formatCost, formatDuration } from '~/03.domain/user'

interface Props {
  summary: AdminAnalyticsOverview['summary']
  periodDays: number
}

const props = defineProps<Props>()

const cards = computed(() => [
  {
    key: 'audience',
    icon: 'mdi:account-check-outline',
    accent: 'sage',
    label: 'DAU / WAU / MAU',
    value: `${props.summary.dau} / ${props.summary.wau} / ${props.summary.mau}`,
    hint: `Активны за 7 дн.: ${props.summary.activeSharePercent}% от ${props.summary.totalUsers}`,
  },
  {
    key: 'time',
    icon: 'mdi:clock-outline',
    accent: 'gold',
    label: `Время на сайте (${props.periodDays} дн.)`,
    value: formatDuration(props.summary.totalActiveSecondsPeriod),
    hint: `В читалке: ${formatDuration(props.summary.totalReadingSecondsPeriod)} · ср./день: ${formatDuration(props.summary.avgDailyActiveSecondsPerActiveUser)}`,
  },
  {
    key: 'learning',
    icon: 'mdi:book-open-page-variant-outline',
    accent: 'sage',
    label: `Обучение (${props.periodDays} дн.)`,
    value: `${props.summary.totalPagesReadPeriod} стр.`,
    hint: `+${props.summary.totalWordsAddedPeriod} слов · ${props.summary.totalWordsReviewedPeriod} повторений`,
  },
  {
    key: 'llm',
    icon: 'mdi:sparkles',
    accent: 'info',
    label: `Расход LLM (${props.periodDays} дн.)`,
    value: formatCost(props.summary.totalLlmCostPeriod),
    hint: 'Оценка по тарифам используемых моделей',
  },
])
</script>

<template>
  <div class="kpi-row">
    <article
      v-for="card in cards"
      :key="card.key"
      class="kpi-card"
    >
      <div class="kpi-card__top">
        <span class="kpi-card__label">{{ card.label }}</span>
        <span class="kpi-card__icon-wrap" :class="`kpi-card__icon-wrap--${card.accent}`">
          <Icon :icon="card.icon" class="kpi-card__icon" />
        </span>
      </div>
      <div class="kpi-card__value" :class="`kpi-card__value--${card.accent}`">
        {{ card.value }}
      </div>
      <div class="kpi-card__hint">
        {{ card.hint }}
      </div>
    </article>
  </div>
</template>

<style scoped>
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 1180px) {
  .kpi-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }
}

.kpi-card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kpi-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kpi-card__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-secondary-color, #8e867b);
}

.kpi-card__icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-card__icon-wrap--sage {
  background: var(--bg-success-color, #e4eee6);
  color: var(--fg-accent-color, #4b8266);
}

.kpi-card__icon-wrap--gold {
  background: var(--bg-warning-color, #fcf4dd);
  color: var(--fg-warning-color, #b38f2b);
}

.kpi-card__icon-wrap--info {
  background: var(--bg-info-color, #e0e7ee);
  color: var(--fg-info-color, #617a94);
}

.kpi-card__icon {
  font-size: 17px;
}

.kpi-card__value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--fg-primary-color, #4a443c);
  letter-spacing: -0.3px;
}

.kpi-card__value--gold {
  color: var(--fg-warning-color, #b38f2b);
}

.kpi-card__value--sage {
  color: var(--fg-accent-color, #4b8266);
}

.kpi-card__hint {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  line-height: 1.4;
}
</style>
