<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

const props = defineProps<{ activityData: { date: string, count: number }[] }>()

const scrollAreaRef = ref<HTMLElement | null>(null)

const WEEKS_TO_SHOW = 26 // Полгода

const heatmapData = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let dayOfWeek = today.getDay()
  if (dayOfWeek === 0)
    dayOfWeek = 7 // 1=Пн .. 7=Вс

  const daysToSunday = 7 - dayOfWeek

  const endDate = new Date(today)
  endDate.setDate(today.getDate() + daysToSunday)

  const totalDays = WEEKS_TO_SHOW * 7
  const startDate = new Date(endDate)
  startDate.setDate(endDate.getDate() - totalDays + 1)

  const days = []
  const months: Array<{ id: string, name: string, col: number }> = []

  let currentMonth = -1

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)

    const isFuture = d > today
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`

    // Добавляем месяц в массив, если это 1-е число ИЛИ самый первый день в графике
    if (d.getDate() === 1 || i === 0) {
      const m = d.getMonth()
      if (m !== currentMonth) {
        currentMonth = m
        const col = Math.floor(i / 7) + 1

        // Предотвращаем наложение текста месяцев (НояДек)
        if (months.length > 0) {
          const lastMonth = months[months.length - 1]
          // Если между прошлым лейблом и новым меньше 3-х колонок, удаляем прошлый
          if (col - lastMonth.col < 3) {
            months.pop()
          }
        }

        if (col <= WEEKS_TO_SHOW - 1) {
          months.push({
            id: `${yyyy}-${m}`,
            name: d.toLocaleString('ru-RU', { month: 'short' }).replace('.', ''),
            col,
          })
        }
      }
    }

    let level = 0
    let count = 0
    if (!isFuture) {
      const active = props.activityData.find(x => x.date === dateStr)
      count = active?.count || 0
      if (count > 0)
        level = 1
      if (count >= 10)
        level = 2
      if (count >= 20)
        level = 3
      if (count >= 40)
        level = 4
    }

    days.push({
      date: dateStr,
      dateFormatted: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
      level,
      count,
      future: isFuture,
    })
  }

  return { days, months }
})

const totalActivity = computed(() => {
  return props.activityData.reduce((acc, curr) => acc + curr.count, 0)
})

const maxStreak = computed(() => {
  let max = 0
  let current = 0

  const sorted = [...props.activityData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  if (sorted.length === 0)
    return 0

  let prevDate: Date | null = null

  for (const item of sorted) {
    if (item.count > 0) {
      if (!prevDate) {
        current = 1
      }
      else {
        const currDate = new Date(item.date)
        const diffTime = Math.abs(currDate.getTime() - prevDate.getTime())
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays === 1) {
          current++
        }
        else if (diffDays > 1) {
          current = 1
        }
      }
      prevDate = new Date(item.date)
      max = Math.max(max, current)
    }
  }
  return max
})

onMounted(async () => {
  await nextTick()
  if (scrollAreaRef.value) {
    scrollAreaRef.value.scrollLeft = scrollAreaRef.value.scrollWidth
  }
})
</script>

<template>
  <div class="activity-section">
    <div class="stats-overview">
      <div class="stat-box">
        <span class="stat-value">{{ totalActivity }}</span>
        <span class="stat-label">Всего действий</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{{ maxStreak }}</span>
        <span class="stat-label">Макс. серия дней</span>
      </div>
    </div>

    <div class="heatmap-container">
      <div ref="scrollAreaRef" class="heatmap-scroll-area">
        <div class="heatmap-wrapper">
          <div class="months-labels">
            <span v-for="month in heatmapData.months" :key="month.id" :style="{ gridColumn: month.col }">
              {{ month.name }}
            </span>
          </div>

          <div class="heatmap-main">
            <div class="weekday-labels">
              <span>Пн</span>
              <span />
              <span>Ср</span>
              <span />
              <span>Пт</span>
              <span />
              <span>Вс</span>
            </div>

            <div class="heatmap-grid">
              <div
                v-for="day in heatmapData.days"
                :key="day.date"
                class="heatmap-cell"
                :class="[{ 'is-future': day.future }, `level-${day.level}`]"
                :title="day.future ? '' : `${day.count} действий (${day.dateFormatted})`"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="heatmap-footer">
        <span>Меньше</span>
        <div class="legend-boxes">
          <div class="legend-box level-0" />
          <div class="legend-box level-1" />
          <div class="legend-box level-2" />
          <div class="legend-box level-3" />
          <div class="legend-box level-4" />
        </div>
        <span>Больше</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-overview {
  display: flex;
  gap: 16px;

  .stat-box {
    flex: 1;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 16px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 4px;

    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--fg-accent-color);
    }

    .stat-label {
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }
}

.heatmap-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 16px;
  border-radius: 12px;
}

.heatmap-scroll-area {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 12px;

  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-primary-color);
    border-radius: 4px;
  }
}

.heatmap-wrapper {
  display: inline-flex;
  flex-direction: column;
  min-width: max-content;
  width: 100%;
  align-items: center;
}

.months-labels {
  display: grid;
  grid-template-columns: repeat(26, 14px);
  gap: 4px;
  margin-bottom: 8px;
  margin-left: 28px;
  font-size: 0.75rem;
  color: var(--fg-secondary-color);

  span {
    grid-row: 1;
    text-transform: capitalize;
  }
}

.heatmap-main {
  display: flex;
  gap: 8px;
}

.weekday-labels {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--fg-secondary-color);

  span {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 14px;
    line-height: 1;
  }
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(26, 14px);
  grid-template-rows: repeat(7, 14px);
  gap: 4px;
  grid-auto-flow: column;
}

/* Общие стили для ячеек графика и боксов легенды */
.heatmap-cell,
.legend-box {
  width: 14px;
  height: 14px;
  border-radius: 3px;

  &.level-0 {
    background-color: var(--bg-tertiary-color);
  }

  /* Используем --fg-accent-color-rgb чтобы цвет был насыщенным в обеих темах */
  &.level-1 {
    background-color: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.25);
  }
  &.level-2 {
    background-color: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.5);
  }
  &.level-3 {
    background-color: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.75);
  }
  &.level-4 {
    background-color: var(--fg-accent-color);
  }
}

.heatmap-cell {
  transition:
    opacity 0.2s,
    transform 0.1s;

  &:not(.is-future):hover {
    opacity: 0.8;
    transform: scale(1.2);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
    z-index: 1;
  }

  &.is-future {
    background-color: transparent;
    border: 1px dashed var(--border-secondary-color);
    opacity: 0.3;
  }
}

.heatmap-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--fg-secondary-color);

  .legend-boxes {
    display: flex;
    gap: 4px;
    align-items: center;
  }
}
</style>
