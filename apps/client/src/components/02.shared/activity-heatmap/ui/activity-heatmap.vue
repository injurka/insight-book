<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { DIFFICULTY_SYSTEMS } from '~/shared/constants/difficulties'

const props = defineProps<{
  activityData: { date: string, count: number }[]
  stats?: {
    learnedWords: number
    readPages: number
    difficulties: { language: string, difficulty: string, count: number }[]
    quizProgress?: { language: string, levelValue: string, bestScore: number, stars: number, unlocked: boolean }[]
  }
}>()
const emit = defineEmits<{
  clickLevel: [data: { language: string, levelValue: string }]
}>()
const { t, locale } = useI18n()
const scrollAreaRef = ref<HTMLElement | null>(null)

const WEEKS_TO_SHOW = 26

function formatNum(num: number) {
  return new Intl.NumberFormat(locale.value).format(num || 0)
}

const heatmapData = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let dayOfWeek = today.getDay()
  if (dayOfWeek === 0)
    dayOfWeek = 7

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

    if (d.getDate() === 1 || i === 0) {
      const m = d.getMonth()
      if (m !== currentMonth) {
        currentMonth = m
        const col = Math.floor(i / 7) + 1

        if (months.length > 0) {
          const lastMonth = months[months.length - 1]
          if (col - lastMonth.col < 3) {
            months.pop()
          }
        }

        if (col <= WEEKS_TO_SHOW - 1) {
          months.push({
            id: `${yyyy}-${m}`,
            name: d.toLocaleString('default', { month: 'short' }).replace('.', ''),
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
      dateFormatted: d.toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' }),
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

const userAchievements = computed(() => {
  const achs: Array<{
    type: 'vocab' | 'quiz'
    lang: string
    current: string
    next?: string | null
    progress?: number
    count?: number
    target?: number
    testPassed?: boolean
    testStars?: number
    testScore?: number
    labelType: string
  }> = []

  if (!props.stats)
    return achs

  // 1. Vocabulary achievements
  if (props.stats.difficulties) {
    const langGroups: Record<string, number> = {}
    for (const d of props.stats.difficulties) {
      langGroups[d.language] = (langGroups[d.language] || 0) + d.count
    }

    const VOCAB_RANKS = [
      { label: t('activityHeatmap.ranks.beginner', 'Новичок'), target: 50 },
      { label: t('activityHeatmap.ranks.seeker', 'Искатель'), target: 150 },
      { label: t('activityHeatmap.ranks.apprentice', 'Ученик'), target: 300 },
      { label: t('activityHeatmap.ranks.knower', 'Знаток'), target: 500 },
      { label: t('activityHeatmap.ranks.experienced', 'Опытный'), target: 1000 },
      { label: t('activityHeatmap.ranks.expert', 'Эксперт'), target: 3000 },
      { label: t('activityHeatmap.ranks.master', 'Мастер'), target: 5000 },
      { label: t('activityHeatmap.ranks.polyglot', 'Полиглот'), target: 10000 },
    ]

    for (const [lang, totalWords] of Object.entries(langGroups)) {
      let currentRankIdx = 0
      for (let i = 0; i < VOCAB_RANKS.length; i++) {
        if (totalWords >= (i === 0 ? 0 : VOCAB_RANKS[i - 1].target)) {
          currentRankIdx = i
        }
      }

      const current = VOCAB_RANKS[currentRankIdx].label
      const nextObj = currentRankIdx + 1 < VOCAB_RANKS.length ? VOCAB_RANKS[currentRankIdx + 1] : null
      const next = nextObj ? nextObj.label : null

      const target = nextObj ? nextObj.target : VOCAB_RANKS[currentRankIdx].target
      const progress = nextObj
        ? Math.min(100, Math.round((totalWords / target) * 100))
        : 100

      achs.push({
        type: 'vocab',
        lang,
        current,
        next,
        count: totalWords,
        target,
        progress,
        labelType: t('activityHeatmap.vocabLevel', 'Словарный запас'),
      })
    }
  }

  // 2. Quiz Level achievements
  if (props.stats.quizProgress) {
    const passedQuizzes = props.stats.quizProgress.filter(q => q.bestScore >= 80)
    const highestQuizPerLang: Record<string, any> = {}

    for (const q of passedQuizzes) {
      const sys = DIFFICULTY_SYSTEMS[q.language] || DIFFICULTY_SYSTEMS.default
      const sysLevels = [...sys].sort((a, b) => a.level - b.level)

      const qLevelIdx = sysLevels.findIndex(l => l.value === q.levelValue || l.label === q.levelValue)

      if (!highestQuizPerLang[q.language] || highestQuizPerLang[q.language].levelIdx < qLevelIdx) {
        highestQuizPerLang[q.language] = {
          ...q,
          levelIdx: qLevelIdx,
          current: q.levelValue,
        }
      }
    }

    for (const [lang, q] of Object.entries(highestQuizPerLang)) {
      achs.push({
        type: 'quiz',
        lang,
        current: q.current,
        testPassed: true,
        testScore: q.bestScore,
        testStars: q.stars,
        labelType: t('activityHeatmap.langLevel', 'Уровень языка'),
      })
    }
  }

  return achs
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
        <span class="stat-value">{{ formatNum(totalActivity) }}</span>
        <span class="stat-label">{{ t('activityHeatmap.totalActions') }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{{ formatNum(maxStreak) }}</span>
        <span class="stat-label">{{ t('activityHeatmap.maxStreak') }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{{ formatNum(stats?.readPages || 0) }}</span>
        <span class="stat-label">{{ t('activityHeatmap.readPages') }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-value">{{ formatNum(stats?.learnedWords || 0) }}</span>
        <span class="stat-label">{{ t('activityHeatmap.learnedWords') }}</span>
      </div>
    </div>

    <div v-if="userAchievements.length > 0" class="levels-section">
      <h3 class="section-title">
        <Icon icon="mdi:trophy-outline" /> {{ t('activityHeatmap.achievements') }}
      </h3>
      <div class="levels-grid">
        <div
          v-for="lvl in userAchievements"
          :key="`${lvl.lang}-${lvl.type}`"
          class="level-card"
          :class="{ 'is-interactive': lvl.type === 'quiz' }"
          @click="lvl.type === 'quiz' ? emit('clickLevel', { language: lvl.lang, levelValue: lvl.current }) : undefined"
        >
          <div class="level-header">
            <div class="level-main-info">
              <span class="lang-badge">{{ lvl.lang.toUpperCase() }}</span>
              <div class="level-info">
                <span class="current-level">{{ lvl.current }}</span>
                <span class="label-type">{{ lvl.labelType }}</span>
              </div>
            </div>
            <!-- Иконка верификации теста -->
            <div v-if="lvl.testPassed" class="test-verified-badge" :title="`Уровень подтвержден тестом на ${lvl.testScore}%`">
              <Icon icon="mdi:check-decagram" class="verified-icon" />
              <span class="stars-indicator">
                <Icon v-for="n in lvl.testStars" :key="n" icon="mdi:star" class="star-icon" />
              </span>
            </div>
          </div>

          <div v-if="lvl.type === 'vocab' && lvl.next" class="level-progress-box">
            <div class="progress-info">
              <span class="next-label">
                {{ t('activityHeatmap.nextLevel') }}: <span class="next-value">{{ lvl.next }}</span>
              </span>
              <span class="progress-fraction" :title="t('activityHeatmap.learnedWords')">{{ lvl.count }} / {{ lvl.target }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: `${lvl.progress}%` }" />
            </div>
          </div>

          <div v-else-if="lvl.type === 'vocab'" class="level-max">
            <Icon icon="mdi:star-face" class="max-icon" /> {{ t('activityHeatmap.maxLevelReached') }}
          </div>
        </div>
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
              <span>{{ t('activityHeatmap.mon') }}</span>
              <span />
              <span>{{ t('activityHeatmap.wed') }}</span>
              <span />
              <span>{{ t('activityHeatmap.fri') }}</span>
              <span />
              <span>{{ t('activityHeatmap.sun') }}</span>
            </div>

            <div class="heatmap-grid">
              <div
                v-for="day in heatmapData.days"
                :key="day.date"
                class="heatmap-cell"
                :class="[{ 'is-future': day.future }, `level-${day.level}`]"
                :title="day.future ? '' : `${formatNum(day.count)} ${t('activityHeatmap.actions')} (${day.dateFormatted})`"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="heatmap-footer">
        <span>{{ t('activityHeatmap.less') }}</span>
        <div class="legend-boxes">
          <div class="legend-box level-0" />
          <div class="legend-box level-1" />
          <div class="legend-box level-2" />
          <div class="legend-box level-3" />
          <div class="legend-box level-4" />
        </div>
        <span>{{ t('activityHeatmap.more') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.activity-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 6px;

  @include media-down(md) {
    grid-template-columns: repeat(2, 1fr);
  }

  .stat-box {
    flex: 1;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 20px 16px;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    position: relative;
    z-index: 0;
    transition:
      box-shadow 0.2s ease,
      border-color 0.2s ease;

    &:hover {
      z-index: 1;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
      border-color: var(--border-primary-color);
    }

    .stat-value {
      font-size: 2.2rem;
      font-weight: 800;
      color: var(--fg-accent-color);
      line-height: 1;
    }

    .stat-label {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--fg-secondary-color);
    }
  }
}

.levels-section {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .section-title {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;

    svg {
      color: var(--fg-accent-color);
      font-size: 1.4rem;
    }
  }

  .levels-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    padding: 6px;
  }

  .level-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    z-index: 0;
    transition:
      transform 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;

    &.is-interactive {
      cursor: pointer;
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.06);
        border-color: var(--fg-accent-color);
      }
    }

    .level-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;

      .level-main-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .lang-badge {
        background: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.15);
        color: var(--fg-accent-color);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 800;
      }

      .level-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .current-level {
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--fg-primary-color);
        line-height: 1.2;
      }

      .label-type {
        font-size: 0.75rem;
        color: var(--fg-secondary-color);
        font-weight: 500;
        line-height: 1;
      }

      .test-verified-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        background: rgba(255, 179, 0, 0.08);
        border: 1px solid rgba(255, 179, 0, 0.2);
        padding: 2px 6px;
        border-radius: 99px;

        .verified-icon {
          color: #ff9800;
          font-size: 1rem;
        }

        .stars-indicator {
          display: flex;
          align-items: center;
          gap: 1px;

          .star-icon {
            color: #ffc107;
            font-size: 0.75rem;
          }
        }
      }
    }

    .level-progress-box {
      background: var(--bg-primary-color);
      border: 1px dashed var(--border-primary-color);
      padding: 12px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 10px;

      .progress-info {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .next-label {
          font-size: 0.85rem;
          color: var(--fg-secondary-color);

          .next-value {
            color: var(--fg-primary-color);
            font-weight: 600;
            margin-left: 4px;
          }
        }

        .progress-fraction {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--fg-accent-color);
          background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.1);
          padding: 2px 8px;
          border-radius: 99px;
          font-variant-numeric: tabular-nums;
        }
      }

      .progress-bar {
        height: 6px;
        background-color: var(--bg-tertiary-color);
        border-radius: 3px;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          background-color: var(--fg-accent-color);
          transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
      }
    }

    .level-max {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--fg-success-color);
      font-weight: 600;
      font-size: 0.95rem;

      .max-icon {
        font-size: 1.2rem;
      }
    }
  }
}

.heatmap-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.heatmap-scroll-area {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 16px;

  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 6px;

    &:hover {
      background-color: var(--border-primary-color);
    }
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
  margin-bottom: 10px;
  margin-left: 36px; /* 28px width + 8px gap */
  font-size: 0.75rem;
  font-weight: 600;
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
  font-weight: 500;
  color: var(--fg-secondary-color);
  width: 28px;

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
  border-radius: 4px; /* Более округлые ячейки */

  &.level-0 {
    background-color: var(--bg-tertiary-color);
  }

  /* Используем --fg-accent-color-rgb чтобы цвет был насыщенным в обеих темах */
  &.level-1 {
    background-color: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.3);
  }
  &.level-2 {
    background-color: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.55);
  }
  &.level-3 {
    background-color: rgba(var(--fg-accent-color-rgb, 225, 96, 50), 0.8);
  }
  &.level-4 {
    background-color: var(--fg-accent-color);
  }
}

.heatmap-cell {
  transition:
    opacity 0.2s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;

  &:not(.is-future):hover {
    opacity: 1;
    transform: scale(1.15);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    z-index: 10;
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
  gap: 12px;
  margin-top: 16px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-secondary-color);

  .legend-boxes {
    display: flex;
    gap: 4px;
    align-items: center;
  }
}
</style>
