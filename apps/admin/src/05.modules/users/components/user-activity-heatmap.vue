<script setup lang="ts">
import type { UserHeatmapDay } from '~/01.shared/types/models'
import { computed, ref } from 'vue'
import { formatDuration } from '~/03.domain/user'

interface Props {
  days: UserHeatmapDay[]
}

const props = defineProps<Props>()

interface CalendarCell {
  date: string
  level: 0 | 1 | 2 | 3 | 4
  data: UserHeatmapDay | null
}

const MS_PER_DAY = 86_400_000

const hoveredCell = ref<CalendarCell | null>(null)

function resolveActivityLevel(entry: UserHeatmapDay | null): 0 | 1 | 2 | 3 | 4 {
  if (!entry)
    return 0

  if (entry.count >= 20)
    return 4
  if (entry.count >= 10)
    return 3
  if (entry.count >= 4)
    return 2
  if (entry.count >= 1 || entry.activeSeconds > 0)
    return 1

  return 0
}

const weeks = computed(() => {
  const byDate = new Map(props.days.map(d => [d.date, d]))

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const todayMs = today.getTime()

  const start = new Date(todayMs - 181 * MS_PER_DAY)
  const dayOfWeek = (start.getUTCDay() + 6) % 7
  let cursorMs = start.getTime() - dayOfWeek * MS_PER_DAY

  const result: CalendarCell[][] = []
  let currentWeek: CalendarCell[] = []

  while (cursorMs <= todayMs) {
    const dateStr = new Date(cursorMs).toISOString().slice(0, 10)
    const entry = byDate.get(dateStr) ?? null

    currentWeek.push({ date: dateStr, level: resolveActivityLevel(entry), data: entry })

    if (currentWeek.length === 7) {
      result.push(currentWeek)
      currentWeek = []
    }

    cursorMs += MS_PER_DAY
  }

  if (currentWeek.length > 0)
    result.push(currentWeek)

  return result
})

function formatDateRu(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')

  return `${d}.${m}.${y}`
}
</script>

<template>
  <div class="heatmap">
    <div class="heatmap__grid" @mouseleave="hoveredCell = null">
      <div
        v-for="(week, wIdx) in weeks"
        :key="wIdx"
        class="heatmap__week"
      >
        <div
          v-for="cell in week"
          :key="cell.date"
          class="heatmap__cell"
          :class="`heatmap__cell--l${cell.level}`"
          @mouseenter="hoveredCell = cell"
        />
      </div>
    </div>

    <div class="heatmap__footer">
      <div class="heatmap__inspector">
        <template v-if="hoveredCell">
          <strong>{{ formatDateRu(hoveredCell.date) }}:</strong>
          <template v-if="hoveredCell.data">
            {{ formatDuration(hoveredCell.data.activeSeconds) }} ·
            {{ hoveredCell.data.pagesRead }} стр. ·
            +{{ hoveredCell.data.wordsAdded }} / {{ hoveredCell.data.wordsReviewed }} сл.
          </template>
          <template v-else>
            Нет активности
          </template>
        </template>
        <template v-else>
          Активность за последние 26 недель (наведите на ячейку)
        </template>
      </div>

      <div class="heatmap__legend">
        <span>Меньше</span>
        <span class="heatmap__cell heatmap__cell--l0" />
        <span class="heatmap__cell heatmap__cell--l1" />
        <span class="heatmap__cell heatmap__cell--l2" />
        <span class="heatmap__cell heatmap__cell--l3" />
        <span class="heatmap__cell heatmap__cell--l4" />
        <span>Больше</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.heatmap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.heatmap__grid {
  display: flex;
  gap: 3px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.heatmap__week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.heatmap__cell {
  width: 12px;
  height: 12px;
  border-radius: 2.5px;
  flex-shrink: 0;
  transition: transform 0.1s;
}

.heatmap__grid .heatmap__cell:hover {
  transform: scale(1.25);
}

.heatmap__cell--l0 {
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
}

.heatmap__cell--l1 {
  background: #c7dfd0;
}

.heatmap__cell--l2 {
  background: #8ec0a4;
}

.heatmap__cell--l3 {
  background: #5d9b79;
}

.heatmap__cell--l4 {
  background: #35674d;
}

.heatmap__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: var(--fg-secondary-color, #8e867b);
}

.heatmap__inspector strong {
  color: var(--fg-primary-color, #4a443c);
}

.heatmap__legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
