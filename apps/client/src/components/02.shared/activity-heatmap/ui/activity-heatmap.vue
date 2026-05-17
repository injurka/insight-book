<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ activityData: { date: string, count: number }[] }>()

const days = computed(() => {
  const result = []
  const today = new Date()

  for (let i = 181; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const active = props.activityData.find(x => x.date === dateStr)

    let level = 0
    if (active) {
      if (active.count > 0)
        level = 1
      if (active.count > 10)
        level = 2
      if (active.count > 30)
        level = 3
      if (active.count > 50)
        level = 4
    }

    result.push({ date: dateStr, level, count: active?.count || 0 })
  }
  return result
})
</script>

<template>
  <div class="heatmap-container">
    <div class="heatmap-grid">
      <div
        v-for="day in days" :key="day.date"
        class="heatmap-cell"
        :class="`level-${day.level}`"
        :title="`${day.date}: ${day.count} действий`"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 1fr);
  gap: 4px;
  width: max-content;
}
.heatmap-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background-color: var(--bg-tertiary-color);

  &.level-1 {
    background-color: rgba(var(--bg-accent-color-rgb), 0.4);
  }
  &.level-2 {
    background-color: rgba(var(--bg-accent-color-rgb), 0.6);
  }
  &.level-3 {
    background-color: rgba(var(--bg-accent-color-rgb), 0.8);
  }
  &.level-4 {
    background-color: var(--fg-accent-color);
  }
}
</style>
