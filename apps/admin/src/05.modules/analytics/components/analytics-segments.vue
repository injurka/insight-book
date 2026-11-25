<script setup lang="ts">
import type { AnalyticsSegmentsSummary, UserLifecycleSegment } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { SEGMENT_META } from '~/03.domain/user'

interface Props {
  segments: AnalyticsSegmentsSummary
  totalUsers: number
}

const props = defineProps<Props>()

const items = computed(() => {
  const entries: Array<{ key: UserLifecycleSegment, count: number }> = [
    { key: 'active', count: props.segments.active },
    { key: 'cooling', count: props.segments.cooling },
    { key: 'inactive', count: props.segments.inactive },
    { key: 'never_activated', count: props.segments.neverActivated },
  ]

  return entries.map((entry) => {
    const meta = SEGMENT_META[entry.key]
    const percent = props.totalUsers > 0 ? Math.round((entry.count / props.totalUsers) * 100) : 0

    return {
      ...entry,
      ...meta,
      percent,
    }
  })
})
</script>

<template>
  <section class="segments-card">
    <div class="segments-card__header">
      <Icon icon="mdi:account-details-outline" class="segments-card__icon" />
      <div>
        <h2 class="segments-card__title">
          Сегменты аудитории
        </h2>
        <p class="segments-card__subtitle">
          Кликните по сегменту, чтобы открыть список этих пользователей
        </p>
      </div>
    </div>

    <div class="segments-bar" role="img" aria-label="Распределение пользователей по сегментам">
      <div
        v-for="item in items"
        :key="item.key"
        class="segments-bar__chunk"
        :style="{ width: `${item.percent}%`, backgroundColor: item.color }"
        :title="`${item.label}: ${item.count} (${item.percent}%)`"
      />
    </div>

    <div class="segments-grid">
      <RouterLink
        v-for="item in items"
        :key="item.key"
        :to="{ name: 'users', query: { segment: item.key } }"
        class="segment-tile"
      >
        <div class="segment-tile__top">
          <span class="segment-tile__dot" :style="{ backgroundColor: item.color }" />
          <span class="segment-tile__label">{{ item.label }}</span>
          <Icon icon="mdi:chevron-right" class="segment-tile__arrow" />
        </div>
        <div class="segment-tile__nums">
          <span class="segment-tile__count">{{ item.count }}</span>
          <span class="segment-tile__pct">{{ item.percent }}%</span>
        </div>
        <p class="segment-tile__desc">
          {{ item.description }}
        </p>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.segments-card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.segments-card__header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.segments-card__icon {
  font-size: 22px;
  color: var(--fg-accent-color, #4b8266);
  margin-top: 1px;
  flex-shrink: 0;
}

.segments-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
}

.segments-card__subtitle {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  margin: 3px 0 0;
}

.segments-bar {
  display: flex;
  height: 12px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  gap: 2px;
}

.segments-bar__chunk {
  height: 100%;
  transition: width 0.35s ease;
}

.segments-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 640px) {
  .segments-grid {
    grid-template-columns: 1fr;
  }
}

.segment-tile {
  text-decoration: none;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition:
    border-color 0.15s,
    transform 0.15s;
}

.segment-tile:hover {
  border-color: var(--border-accent-color, #5a9c7b);
  transform: translateY(-1px);
}

.segment-tile__top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.segment-tile__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

.segment-tile__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
}

.segment-tile__arrow {
  margin-left: auto;
  color: var(--fg-secondary-color, #8e867b);
  font-size: 16px;
}

.segment-tile__nums {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.segment-tile__count {
  font-size: 24px;
  font-weight: 700;
  color: var(--fg-primary-color, #4a443c);
  line-height: 1.1;
}

.segment-tile__pct {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
}

.segment-tile__desc {
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
  margin: 0;
  line-height: 1.35;
}
</style>
