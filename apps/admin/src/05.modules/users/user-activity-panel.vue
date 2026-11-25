<script setup lang="ts">
import type { AdminUserDetailedAnalytics } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBadge from '~/02.kit/atoms/kit-badge.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'
import {
  formatCost,
  formatDuration,
  formatRelativeTime,
  formatTokens,
  getSegmentMeta,
} from '~/03.domain/user'
import UserActivityHeatmap from './components/user-activity-heatmap.vue'

interface Props {
  id: string
}

const props = defineProps<Props>()
const { admin } = useRepos()

const analytics = ref<AdminUserDetailedAnalytics | null>(null)
const loading = ref(true)
const error = ref('')

const segmentMeta = computed(() =>
  analytics.value ? getSegmentMeta(analytics.value.segment) : null,
)

const completedStepsCount = computed(() =>
  analytics.value ? analytics.value.funnelSteps.filter(s => s.completed).length : 0,
)

function bookProgressPercent(currentPage: number, totalPages: number): number {
  if (totalPages <= 0)
    return 0

  return Math.min(100, Math.round((currentPage / totalPages) * 100))
}

async function load() {
  loading.value = true
  error.value = ''

  try {
    analytics.value = await admin.getUserAnalytics(Number(props.id))
  }
  catch (e: unknown) {
    error.value = (e as Error).message || 'Не удалось загрузить аналитику пользователя'
  }
  finally {
    loading.value = false
  }
}

watch(() => props.id, () => load())
onMounted(() => load())
</script>

<template>
  <div class="user-analytics">
    <KitError v-if="error" :message="error" />

    <div v-if="loading" class="user-analytics__skeletons">
      <KitSkeleton height="120px" border-radius="10px" />
      <KitSkeleton height="190px" border-radius="10px" />
      <KitSkeleton height="180px" border-radius="10px" />
    </div>

    <template v-else-if="analytics && segmentMeta">
      <!-- Header & Lifecycle Summary -->
      <section class="ua-card">
        <div class="ua-card__head">
          <div class="ua-card__title-group">
            <Icon icon="mdi:chart-timeline-variant" class="ua-card__icon" />
            <h2 class="ua-card__title">
              Активность и вовлечённость
            </h2>
          </div>
          <KitBadge :variant="segmentMeta.badgeVariant">
            {{ segmentMeta.shortLabel }}
          </KitBadge>
        </div>

        <div class="ua-metrics">
          <div class="ua-metric">
            <span class="ua-metric__label">Последний визит</span>
            <span class="ua-metric__value">{{ formatRelativeTime(analytics.lastActiveAt) }}</span>
            <span class="ua-metric__sub">{{ analytics.activeDaysTotal }} акт. дн. всего</span>
          </div>
          <div class="ua-metric">
            <span class="ua-metric__label">Всего на сайте</span>
            <span class="ua-metric__value ua-metric__value--sage">
              {{ formatDuration(analytics.time.totalActiveSeconds) }}
            </span>
            <span class="ua-metric__sub">
              7д: {{ formatDuration(analytics.time.last7DaysSeconds) }} · 30д: {{ formatDuration(analytics.time.last30DaysSeconds) }}
            </span>
          </div>
          <div class="ua-metric">
            <span class="ua-metric__label">Читалка / SRS</span>
            <span class="ua-metric__value">
              {{ formatDuration(analytics.time.totalReadingSeconds) }}
            </span>
            <span class="ua-metric__sub">
              SRS: {{ formatDuration(analytics.time.totalSrsSeconds) }}
            </span>
          </div>
          <div class="ua-metric">
            <span class="ua-metric__label">Стрик</span>
            <span class="ua-metric__value ua-metric__value--gold">
              {{ analytics.currentStreak }} дн.
            </span>
            <span class="ua-metric__sub">рекорд: {{ analytics.longestStreak }} дн.</span>
          </div>
        </div>

        <div class="ua-totals-strip">
          <span><strong>{{ analytics.totals.booksCount }}</strong> книг</span>
          <span><strong>{{ analytics.totals.pagesRead }}</strong> стр. прочитано</span>
          <span><strong>{{ analytics.totals.totalWords }}</strong> слов (выучено {{ analytics.totals.learnedWords }})</span>
          <span><strong>{{ analytics.totals.wordsReviewed }}</strong> повторений</span>
          <span><strong>{{ analytics.totals.highlightsCount }}</strong> заметок</span>
          <span><strong>{{ analytics.totals.pluginsCount }}</strong> плагинов</span>
          <span>Push: <strong>{{ analytics.totals.pushEnabled ? 'вкл' : 'выкл' }}</strong></span>
        </div>
      </section>

      <!-- Personal Funnel -->
      <section class="ua-card">
        <div class="ua-card__head">
          <div class="ua-card__title-group">
            <Icon icon="mdi:check-decagram-outline" class="ua-card__icon" />
            <h2 class="ua-card__title">
              Этапы воронки ({{ completedStepsCount }} / {{ analytics.funnelSteps.length }})
            </h2>
          </div>
        </div>

        <div class="ua-funnel-grid">
          <div
            v-for="step in analytics.funnelSteps"
            :key="step.key"
            class="ua-funnel-chip"
            :class="{ 'ua-funnel-chip--done': step.completed }"
          >
            <Icon
              :icon="step.completed ? 'mdi:check-circle' : 'mdi:circle-outline'"
              class="ua-funnel-chip__icon"
            />
            <span>{{ step.label }}</span>
          </div>
        </div>
      </section>

      <!-- Heatmap -->
      <section class="ua-card">
        <div class="ua-card__head">
          <div class="ua-card__title-group">
            <Icon icon="mdi:calendar-month-outline" class="ua-card__icon" />
            <h2 class="ua-card__title">
              Карта активности
            </h2>
          </div>
          <span class="ua-card__meta">За 30 дн.: {{ analytics.activeDaysLast30 }} дн.</span>
        </div>

        <UserActivityHeatmap :days="analytics.heatmap" />
      </section>

      <!-- Recent Books & LLM Breakdown -->
      <div class="ua-two-col">
        <section class="ua-card">
          <div class="ua-card__head">
            <div class="ua-card__title-group">
              <Icon icon="mdi:book-open-page-variant-outline" class="ua-card__icon" />
              <h2 class="ua-card__title">
                Последние книги
              </h2>
            </div>
          </div>

          <div v-if="analytics.recentBooks.length" class="ua-books">
            <div v-for="book in analytics.recentBooks" :key="book.bookId" class="ua-book">
              <div class="ua-book__top">
                <span class="ua-book__title">{{ book.title }}</span>
                <span class="ua-book__lang">{{ book.language }}</span>
              </div>
              <div class="ua-book__bar">
                <div
                  class="ua-book__bar-fill"
                  :style="{ width: `${bookProgressPercent(book.currentPage, book.totalPages)}%` }"
                />
              </div>
              <div class="ua-book__meta">
                <span>Стр. {{ book.currentPage }} / {{ book.totalPages || '?' }} ({{ bookProgressPercent(book.currentPage, book.totalPages) }}%)</span>
                <span>{{ formatRelativeTime(book.updatedAt) }}</span>
              </div>
            </div>
          </div>
          <p v-else class="ua-empty">
            Пользователь ещё не открывал книги
          </p>
        </section>

        <section class="ua-card">
          <div class="ua-card__head">
            <div class="ua-card__title-group">
              <Icon icon="mdi:sparkles" class="ua-card__icon" />
              <h2 class="ua-card__title">
                Использование AI
              </h2>
            </div>
            <span class="ua-card__cost">{{ formatCost(analytics.llm.totalCost) }}</span>
          </div>

          <div v-if="analytics.llm.byAction.length" class="ua-llm-list">
            <div v-for="item in analytics.llm.byAction" :key="item.action" class="ua-llm-row">
              <span class="ua-llm-row__action">{{ item.action }}</span>
              <span class="ua-llm-row__tokens">
                {{ formatTokens(item.inputTokens + item.outputTokens) }}
              </span>
              <span class="ua-llm-row__cost">{{ formatCost(item.cost) }}</span>
            </div>
          </div>
          <p v-else class="ua-empty">
            AI-запросов пока не было
          </p>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.user-analytics {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.user-analytics__skeletons {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ua-card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ua-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ua-card__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ua-card__icon {
  font-size: 20px;
  color: var(--fg-accent-color, #4b8266);
}

.ua-card__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
}

.ua-card__meta {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
}

.ua-card__cost {
  font-size: 14px;
  font-weight: 700;
  color: var(--fg-accent-color, #4b8266);
}

.ua-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 960px) {
  .ua-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ua-metric {
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ua-metric__label {
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
}

.ua-metric__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--fg-primary-color, #4a443c);
}

.ua-metric__value--sage {
  color: var(--fg-accent-color, #4b8266);
}

.ua-metric__value--gold {
  color: var(--fg-warning-color, #b38f2b);
}

.ua-metric__sub {
  font-size: 11px;
  color: var(--fg-secondary-color, #8e867b);
}

.ua-totals-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 12.5px;
  color: var(--fg-secondary-color, #8e867b);
  padding-top: 4px;
  border-top: 1px solid var(--border-secondary-color, #d9d1c7);
}

.ua-totals-strip strong {
  color: var(--fg-primary-color, #4a443c);
}

.ua-funnel-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 720px) {
  .ua-funnel-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ua-funnel-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 11px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 500;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  color: var(--fg-secondary-color, #8e867b);
}

.ua-funnel-chip--done {
  background: var(--bg-success-color, #e4eee6);
  border-color: var(--border-success-color, #7dae94);
  color: #2d5641;
  font-weight: 600;
}

.ua-funnel-chip__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.ua-two-col {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  align-items: start;
}

@media (max-width: 960px) {
  .ua-two-col {
    grid-template-columns: 1fr;
  }
}

.ua-books {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ua-book {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ua-book__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ua-book__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ua-book__lang {
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  padding: 1px 6px;
  border-radius: 4px;
}

.ua-book__bar {
  height: 6px;
  border-radius: 999px;
  background: var(--bg-primary-color, #f3efe9);
  overflow: hidden;
}

.ua-book__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--fg-accent-color, #4b8266);
}

.ua-book__meta {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
}

.ua-llm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ua-llm-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 10px;
  align-items: center;
  padding: 7px 10px;
  border-radius: 6px;
  background: var(--bg-primary-color, #f3efe9);
  font-size: 12.5px;
}

.ua-llm-row__action {
  color: var(--fg-primary-color, #4a443c);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ua-llm-row__tokens {
  color: var(--fg-secondary-color, #8e867b);
  font-size: 12px;
}

.ua-llm-row__cost {
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
}

.ua-empty {
  margin: 0;
  font-size: 13px;
  color: var(--fg-secondary-color, #8e867b);
  padding: 12px 0;
}
</style>
