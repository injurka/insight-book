<script setup lang="ts">
import type { AdminAnalyticsOverview, DashboardStats } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitStatCard from '~/02.kit/organisms/kit-stat-card.vue'
import { formatDuration } from '~/03.domain/user'
import AnalyticsFunnel from '~/05.modules/analytics/components/analytics-funnel.vue'
import AnalyticsSegments from '~/05.modules/analytics/components/analytics-segments.vue'

const { admin } = useRepos()

const stats = ref<DashboardStats | null>(null)
const analytics = ref<AdminAnalyticsOverview | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const [statsRes, analyticsRes] = await Promise.allSettled([
      admin.stats(),
      admin.analyticsOverview(7),
    ])

    if (statsRes.status === 'fulfilled')
      stats.value = statsRes.value

    if (analyticsRes.status === 'fulfilled')
      analytics.value = analyticsRes.value
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dashboard">
    <h1 class="dashboard-stats__title">
      <Icon icon="mdi:view-dashboard" class="dashboard-stats__title-icon" />
      <span>Дашборд</span>
    </h1>

    <div v-if="loading" class="dashboard-stats__grid">
      <KitSkeleton type="stat-card" :count="4" />
    </div>

    <div v-else-if="stats" class="dashboard-stats__grid">
      <KitStatCard :value="stats.totalUsers" label="Всего пользователей" />
      <KitStatCard :value="stats.totalBooks" label="Всего книг" />
      <KitStatCard :value="stats.pendingBooks" label="Книг на модерации" value-color="#b38f2b" />
      <KitStatCard :value="stats.pendingPlugins" label="Плагинов на модерации" value-color="#b38f2b" />
    </div>

    <div class="dashboard-stats__links">
      <RouterLink to="/analytics" class="dashboard-stats__link dashboard-stats__link--accent">
        <Icon icon="mdi:chart-areaspline" class="dashboard-stats__link-icon" />
        <span>Продуктовая аналитика</span>
      </RouterLink>
      <RouterLink to="/users" class="dashboard-stats__link">
        <Icon icon="mdi:account-group" class="dashboard-stats__link-icon" />
        <span>Управление пользователями</span>
      </RouterLink>
      <RouterLink to="/books/pending" class="dashboard-stats__link">
        <Icon icon="mdi:book-open-variant" class="dashboard-stats__link-icon" />
        <span>Модерация книг</span>
      </RouterLink>
      <RouterLink to="/plugins/pending" class="dashboard-stats__link">
        <Icon icon="mdi:puzzle" class="dashboard-stats__link-icon" />
        <span>Модерация плагинов</span>
      </RouterLink>
      <RouterLink to="/plugins" class="dashboard-stats__link">
        <Icon icon="mdi:puzzle-outline" class="dashboard-stats__link-icon" />
        <span>Каталог плагинов</span>
      </RouterLink>
    </div>

    <section v-if="analytics" class="dashboard-pulse">
      <div class="dashboard-pulse__strip">
        <div class="pulse-metric">
          <span class="pulse-metric__label">DAU / WAU / MAU</span>
          <span class="pulse-metric__val">
            {{ analytics.summary.dau }} / {{ analytics.summary.wau }} / {{ analytics.summary.mau }}
          </span>
        </div>
        <div class="pulse-metric">
          <span class="pulse-metric__label">Активны за 7 дней</span>
          <span class="pulse-metric__val pulse-metric__val--sage">
            {{ analytics.summary.activeSharePercent }}%
          </span>
        </div>
        <div class="pulse-metric">
          <span class="pulse-metric__label">Время за 7 дней</span>
          <span class="pulse-metric__val">
            {{ formatDuration(analytics.summary.totalActiveSecondsPeriod) }}
          </span>
        </div>
        <div class="pulse-metric">
          <span class="pulse-metric__label">Прочитано за 7 дней</span>
          <span class="pulse-metric__val">
            {{ analytics.summary.totalPagesReadPeriod }} стр.
          </span>
        </div>
        <RouterLink to="/analytics" class="pulse-more">
          Подробно
          <Icon icon="mdi:arrow-right" />
        </RouterLink>
      </div>

      <div class="dashboard-pulse__grid">
        <AnalyticsFunnel :steps="analytics.funnel" compact>
          <template #header-action>
            <RouterLink to="/analytics" class="dashboard-pulse__link">
              Открыть аналитику
            </RouterLink>
          </template>
        </AnalyticsFunnel>
        <AnalyticsSegments :segments="analytics.segments" :total-users="analytics.summary.totalUsers" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-stats__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard-stats__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}

.dashboard-stats__grid {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.dashboard-stats__links {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.dashboard-stats__link {
  text-decoration: none;
  color: var(--fg-primary-color, #4a443c);
  font-size: 15px;
  font-weight: 500;
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 210px;
  transition:
    border-color 0.15s,
    transform 0.15s;
}

.dashboard-stats__link--accent {
  background: var(--bg-accent-color, #e3eae6);
  border-color: var(--border-success-color, #7dae94);
}

.dashboard-stats__link:hover {
  border-color: var(--border-accent-color, #5a9c7b);
  transform: translateY(-1px);
}

.dashboard-stats__link-icon {
  font-size: 22px;
  color: var(--fg-accent-color, #4b8266);
  flex-shrink: 0;
}

.dashboard-pulse {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dashboard-pulse__strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  padding: 16px 22px;
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
}

.pulse-metric {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pulse-metric__label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--fg-secondary-color, #8e867b);
}

.pulse-metric__val {
  font-size: 18px;
  font-weight: 700;
  color: var(--fg-primary-color, #4a443c);
}

.pulse-metric__val--sage {
  color: var(--fg-accent-color, #4b8266);
}

.pulse-more {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
  text-decoration: none;
}

.pulse-more:hover {
  text-decoration: underline;
}

.dashboard-pulse__grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 18px;
  align-items: start;
}

@media (max-width: 1100px) {
  .dashboard-pulse__grid {
    grid-template-columns: 1fr;
  }
}

.dashboard-pulse__link {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
  text-decoration: none;
}

.dashboard-pulse__link:hover {
  text-decoration: underline;
}
</style>
