<script setup lang="ts">
import type { AdminAnalyticsOverview, AdminEventsOverview } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import AnalyticsEventFunnel from './components/analytics-event-funnel.vue'
import AnalyticsEventStream from './components/analytics-event-stream.vue'
import AnalyticsEventsBreakdown from './components/analytics-events-breakdown.vue'
import AnalyticsFeatureAdoption from './components/analytics-feature-adoption.vue'
import AnalyticsFunnel from './components/analytics-funnel.vue'
import AnalyticsKpiRow from './components/analytics-kpi-row.vue'
import AnalyticsSegments from './components/analytics-segments.vue'
import AnalyticsTopUsers from './components/analytics-top-users.vue'
import AnalyticsTrendChart from './components/analytics-trend-chart.vue'

type AnalyticsViewTab = 'audience' | 'events'

const { admin } = useRepos()
const route = useRoute()
const router = useRouter()

const activeView = ref<AnalyticsViewTab>(route.query.view === 'events' ? 'events' : 'audience')
const periodDays = ref<7 | 30 | 90>(30)
const data = ref<AdminAnalyticsOverview | null>(null)
const eventsOverview = ref<AdminEventsOverview | null>(null)
const selectedStreamEvent = ref<string>('all')
const loading = ref(true)
const error = ref('')

const viewTabs: Array<{ value: AnalyticsViewTab, label: string, icon: string }> = [
  { value: 'audience', label: 'Обзор аудитории', icon: 'mdi:account-group-outline' },
  { value: 'events', label: 'События и воронки', icon: 'mdi:lightning-bolt-outline' },
]

const periodOptions: Array<{ value: 7 | 30 | 90, label: string }> = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
]

async function load() {
  loading.value = true
  error.value = ''

  try {
    const [overviewRes, eventsRes] = await Promise.all([
      admin.analyticsOverview(periodDays.value),
      admin.analyticsEventsOverview(periodDays.value),
    ])
    data.value = overviewRes
    eventsOverview.value = eventsRes
  }
  catch (e: unknown) {
    error.value = (e as Error).message || 'Не удалось загрузить аналитику'
  }
  finally {
    loading.value = false
  }
}

function selectView(view: AnalyticsViewTab) {
  if (activeView.value === view)
    return

  activeView.value = view
  router.replace({ query: view === 'audience' ? {} : { view } })
}

function selectPeriod(days: 7 | 30 | 90) {
  if (periodDays.value === days)
    return

  periodDays.value = days
  load()
}

function onSelectEventFromBreakdown(eventName: string) {
  selectedStreamEvent.value = eventName
}

watch(() => route.query.view, (val) => {
  activeView.value = val === 'events' ? 'events' : 'audience'
})

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
          Аудитория, удержание, время на сайте и живой поток ключевых продуктовых событий
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

    <div class="view-tabs" role="tablist">
      <button
        v-for="tab in viewTabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="activeView === tab.value"
        class="view-tabs__btn"
        :class="{ 'view-tabs__btn--active': activeView === tab.value }"
        @click="selectView(tab.value)"
      >
        <Icon :icon="tab.icon" class="view-tabs__icon" />
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.value === 'events' && eventsOverview"
          class="view-tabs__count"
        >
          {{ eventsOverview.totalPeriodEvents.toLocaleString('ru-RU') }}
        </span>
      </button>
    </div>

    <KitError v-if="error" :message="error" />

    <div v-if="loading && !data" class="analytics-page__skeletons">
      <div class="analytics-page__skeleton-row">
        <KitSkeleton v-for="i in 4" :key="i" height="112px" />
      </div>
      <div class="analytics-page__skeleton-two">
        <KitSkeleton height="310px" />
        <KitSkeleton height="310px" />
      </div>
      <KitSkeleton height="260px" />
    </div>

    <template v-else-if="activeView === 'audience' && data">
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

    <template v-else-if="activeView === 'events' && eventsOverview">
      <AnalyticsEventFunnel
        :catalog="eventsOverview.catalog"
        :period-days="periodDays"
      />

      <AnalyticsEventsBreakdown
        :overview="eventsOverview"
        @cleaned="load"
        @select-event="onSelectEventFromBreakdown"
      />

      <AnalyticsEventStream
        :catalog="eventsOverview.catalog"
        :selected-event-filter="selectedStreamEvent"
      />
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

.view-tabs {
  display: inline-flex;
  align-self: flex-start;
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
}

.view-tabs__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--fg-secondary-color, #8e867b);
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.view-tabs__btn:hover {
  color: var(--fg-primary-color, #4a443c);
}

.view-tabs__btn--active {
  background: var(--bg-primary-color, #f3efe9);
  color: var(--fg-primary-color, #4a443c);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(74, 68, 60, 0.08);
}

.view-tabs__btn--active .view-tabs__icon {
  color: var(--fg-accent-color, #4b8266);
}

.view-tabs__icon {
  font-size: 17px;
}

.view-tabs__count {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--bg-accent-color, #e3eae6);
  color: var(--fg-accent-color, #4b8266);
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
