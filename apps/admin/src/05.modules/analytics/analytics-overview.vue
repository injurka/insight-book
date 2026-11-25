<script setup lang="ts">
import type { AdminAnalyticsOverview } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import AnalyticsFeatureAdoption from './components/analytics-feature-adoption.vue'
import AnalyticsFunnel from './components/analytics-funnel.vue'
import AnalyticsKpiRow from './components/analytics-kpi-row.vue'
import AnalyticsSegments from './components/analytics-segments.vue'
import AnalyticsTopUsers from './components/analytics-top-users.vue'
import AnalyticsTrendChart from './components/analytics-trend-chart.vue'

const { admin } = useRepos()

const periodDays = ref<7 | 30 | 90>(30)
const data = ref<AdminAnalyticsOverview | null>(null)
const loading = ref(true)
const error = ref('')

const periodOptions: Array<{ value: 7 | 30 | 90, label: string }> = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
]

async function load() {
  loading.value = true
  error.value = ''

  try {
    data.value = await admin.analyticsOverview(periodDays.value)
  }
  catch (e: unknown) {
    error.value = (e as Error).message || 'Не удалось загрузить аналитику'
  }
  finally {
    loading.value = false
  }
}

function selectPeriod(days: 7 | 30 | 90) {
  if (periodDays.value === days)
    return

  periodDays.value = days
  load()
}

onMounted(() => load())
</script>

<template>
  <div class="analytics-page">
    <div class="analytics-page__header">
      <div class="analytics-page__title-group">
        <h1 class="analytics-page__title">
          <Icon icon="mdi:chart-areaspline" class="analytics-page__title-icon" />
          <span>Продуктовая аналитика</span>
        </h1>
        <p class="analytics-page__subtitle">
          Воронка активации, активность, вовлечённость и время на сайте
        </p>
      </div>

      <div class="analytics-page__controls">
        <div class="period-switch">
          <button
            v-for="opt in periodOptions"
            :key="opt.value"
            type="button"
            class="period-switch__btn"
            :class="{ 'period-switch__btn--active': periodDays === opt.value }"
            @click="selectPeriod(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <KitBtn
          variant="ghost"
          :disabled="loading"
          title="Обновить"
          @click="load"
        >
          <Icon icon="mdi:refresh" />
        </KitBtn>
      </div>
    </div>

    <KitError v-if="error" :message="error" />

    <div v-if="loading && !data" class="analytics-page__skeletons">
      <div class="analytics-page__skeleton-row">
        <KitSkeleton
          v-for="i in 4"
          :key="i"
          height="112px"
          border-radius="10px"
        />
      </div>
      <div class="analytics-page__skeleton-two">
        <KitSkeleton height="310px" border-radius="10px" />
        <KitSkeleton height="310px" border-radius="10px" />
      </div>
      <KitSkeleton height="260px" border-radius="10px" />
    </div>

    <template v-else-if="data">
      <AnalyticsKpiRow :summary="data.summary" :period-days="data.periodDays" />

      <div class="analytics-page__grid-two">
        <AnalyticsFunnel :steps="data.funnel" />
        <AnalyticsSegments :segments="data.segments" :total-users="data.summary.totalUsers" />
      </div>

      <div class="analytics-page__grid-trend">
        <AnalyticsTrendChart :points="data.dailyTrend" />
        <AnalyticsFeatureAdoption :items="data.featureAdoption" :total-users="data.summary.totalUsers" />
      </div>

      <AnalyticsTopUsers :users="data.topUsers" :period-days="data.periodDays" />
    </template>
  </div>
</template>

<style scoped>
.analytics-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.analytics-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.analytics-page__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.analytics-page__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}

.analytics-page__subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
}

.analytics-page__controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.period-switch {
  display: inline-flex;
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.period-switch__btn {
  border: none;
  background: transparent;
  color: var(--fg-secondary-color, #8e867b);
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.period-switch__btn:hover {
  color: var(--fg-primary-color, #4a443c);
}

.period-switch__btn--active {
  background: var(--fg-accent-color, #4b8266);
  color: #f3efe9;
  font-weight: 600;
}

.analytics-page__grid-two {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 18px;
  align-items: start;
}

.analytics-page__grid-trend {
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  gap: 18px;
  align-items: start;
}

@media (max-width: 1120px) {
  .analytics-page__grid-two,
  .analytics-page__grid-trend {
    grid-template-columns: 1fr;
  }
}

.analytics-page__skeletons {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.analytics-page__skeleton-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.analytics-page__skeleton-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}
</style>
