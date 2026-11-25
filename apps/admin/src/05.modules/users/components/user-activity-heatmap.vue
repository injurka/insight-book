<script setup lang="ts">
import type { UserHeatmapDay } from '~/01.shared/types/models'
import { computed, ref } from 'vue'
import { formatDuration } from '~/03.domain/user'

interface Props {
  days: UserHeatmapDay[]
}

type ActivityLevel = 0 | 1 | 2 | 3 | 4

interface CalendarCell {
  date: string
  level: ActivityLevel
  data: UserHeatmapDay | null
}

const props = defineProps<Props>()

const MS_PER_DAY = 86_400_000
const DAYS_BACK = 181
const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const WEEKDAY_LABELS = ['Пн', '', 'Ср', '', 'Пт', '', '']

const hoveredCell = ref<CalendarCell | null>(null)

function resolveActivityLevel(entry: UserHeatmapDay | null): ActivityLevel {
  if (!entry)
    return 0

  if (entry.count >= 20)
    return 4
  if (entry.count >= 10)
    return 3
  if (entry.count >= 4)
    return 2

  return entry.count >= 1 || entry.activeSeconds > 0 ? 1 : 0
}

function buildWeeks(days: UserHeatmapDay[]): CalendarCell[][] {
  const byDate = new Map(days.map(d => [d.date, d]))
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const start = new Date(today.getTime() - DAYS_BACK * MS_PER_DAY)
  const mondayOffset = (start.getUTCDay() + 6) % 7
  const firstMs = start.getTime() - mondayOffset * MS_PER_DAY
  const totalDays = Math.round((today.getTime() - firstMs) / MS_PER_DAY) + 1

  const cells = Array.from({ length: totalDays }, (_, index): CalendarCell => {
    const date = new Date(firstMs + index * MS_PER_DAY).toISOString().slice(0, 10)
    const data = byDate.get(date) ?? null

    return { date, level: resolveActivityLevel(data), data }
  })

  return Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

function monthOf(week: CalendarCell[] | undefined): number | null {
  return week ? Number(week[0].date.slice(5, 7)) - 1 : null
}

function monthLabelFor(weeks: CalendarCell[][], index: number): string {
  const current = monthOf(weeks[index])
  const previous = index > 0 ? monthOf(weeks[index - 1]) : null

  if (current === null || current === previous)
    return ''

  // Skip a label that would collide with the next month label at the very start.
  if (index === 0 && monthOf(weeks[2]) !== current)
    return ''

  return MONTHS[current]
}

const weeks = computed(() => buildWeeks(props.days))
const monthLabels = computed(() => weeks.value.map((_, index) => monthLabelFor(weeks.value, index)))

function formatDateRu(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')

  return `${d}.${m}.${y}`
}
</script>

<template>
  <div class="heatmap" :style="{ '--weeks': weeks.length }">
    <div class="heatmap__months">
      <span />
      <span v-for="(label, idx) in monthLabels" :key="idx" class="heatmap__month">{{ label }}</span>
    </div>

    <div class="heatmap__grid" @mouseleave="hoveredCell = null">
      <span v-for="(label, idx) in WEEKDAY_LABELS" :key="`wd-${idx}`" class="heatmap__weekday">{{ label }}</span>
      <template v-for="week in weeks">
        <div
          v-for="cell in week"
          :key="cell.date"
          class="heatmap__cell"
          :class="`heatmap__cell--l${cell.level}`"
          @mouseenter="hoveredCell = cell"
        />
      </template>
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
            нет активности
          </template>
        </template>
        <template v-else>
          Наведите на ячейку, чтобы увидеть детали дня
        </template>
      </div>

      <div class="heatmap__legend">
        <span>Меньше</span>
        <span class="heatmap__legend-cell heatmap__cell--l0" />
        <span class="heatmap__legend-cell heatmap__cell--l1" />
        <span class="heatmap__legend-cell heatmap__cell--l2" />
        <span class="heatmap__legend-cell heatmap__cell--l3" />
        <span class="heatmap__legend-cell heatmap__cell--l4" />
        <span>Больше</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.heatmap {
  --heatmap-gap: 3px;
  --heatmap-gutter: 24px;

  display: flex;
  flex-direction: column;
  gap: 6px;
}

.heatmap__months,
.heatmap__grid {
  display: grid;
  gap: var(--heatmap-gap);
}

.heatmap__months {
  grid-template-columns: var(--heatmap-gutter) repeat(var(--weeks), minmax(0, 1fr));
  font-size: 11px;
  color: var(--fg-secondary-color, #8e867b);
}

.heatmap__month {
  white-space: nowrap;
  overflow: visible;
}

.heatmap__grid {
  grid-template-columns: var(--heatmap-gutter) repeat(var(--weeks), minmax(0, 1fr));
  grid-template-rows: repeat(7, auto);
  grid-auto-flow: column;
}

.heatmap__weekday {
  align-self: center;
  font-size: 10.5px;
  color: var(--fg-secondary-color, #8e867b);
}

.heatmap__cell {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 3px;
  transition: transform 0.1s;
}

.heatmap__grid .heatmap__cell:hover {
  transform: scale(1.2);
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
  margin-top: 4px;
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

.heatmap__legend-cell {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
</style>
