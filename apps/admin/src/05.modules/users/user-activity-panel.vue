<script setup lang="ts">
import type { AdminUserDetailedAnalytics } from '~/01.shared/types/models'
import KitPanel from '~/02.kit/organisms/kit-panel.vue'
import UserActivityHeatmap from './components/user-activity-heatmap.vue'
import UserAiUsage from './components/user-ai-usage.vue'
import UserFunnelSteps from './components/user-funnel-steps.vue'
import UserLearningTotals from './components/user-learning-totals.vue'
import UserRecentBooks from './components/user-recent-books.vue'

interface Props {
  analytics: AdminUserDetailedAnalytics
}

defineProps<Props>()
</script>

<template>
  <div class="activity">
    <UserLearningTotals :totals="analytics.totals" />

    <div class="activity__split activity__split--wide-left">
      <KitPanel title="Карта активности" icon="mdi:calendar-month-outline">
        <template #meta>
          {{ analytics.activeDaysLast30 }} акт. дн. за 30 дней
        </template>
        <UserActivityHeatmap :days="analytics.heatmap" />
      </KitPanel>

      <UserFunnelSteps :steps="analytics.funnelSteps" />
    </div>

    <div class="activity__split">
      <UserRecentBooks :books="analytics.recentBooks" />
      <UserAiUsage :llm="analytics.llm" />
    </div>
  </div>
</template>

<style scoped>
.activity {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.activity__split {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@container (min-width: 820px) {
  .activity__split {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .activity__split--wide-left {
    grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  }
}
</style>
