<script setup lang="ts">
import type { Rule } from '../../../../shared/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  currentIndex: number
  totalCount: number
  score: number
  streak: number
  rule?: Rule | null
}

const props = defineProps<Props>()
const { t } = useI18n()

const progressPercent = computed(() => {
  if (props.totalCount <= 0)
    return 0

  return Math.min(100, Math.round(((props.currentIndex + 1) / props.totalCount) * 100))
})
</script>

<template>
  <div class="test-progress-container">
    <!-- Progress Track & Meta -->
    <div class="progress-meta-row">
      <div class="question-step">
        <span class="step-badge">
          {{ t('plugins.grammar-rules.progressText', { current: currentIndex + 1, total: totalCount }) }}
        </span>
        <div v-if="rule" class="rule-hint-pill" :title="rule.pattern || rule.description">
          <Icon icon="mdi:school-outline" />
          <span class="rule-name">{{ rule.title }}</span>
          <span v-if="rule.level" class="rule-lvl">{{ rule.level.toUpperCase() }}</span>
        </div>
      </div>

      <div class="score-streak-group">
        <span v-if="streak >= 2" class="streak-pill" :title="t('plugins.grammar-rules.streakCount', { count: streak })">
          <Icon icon="mdi:fire" class="fire-icon" />
          <span>{{ streak }}</span>
        </span>
        <span class="score-pill">
          {{ t('plugins.grammar-rules.scoreText', { score }) }}
        </span>
      </div>
    </div>

    <!-- Animated Progress Bar -->
    <div class="progress-bar-track">
      <div
        class="progress-bar-fill"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-progress-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.progress-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.question-step {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;

  .step-badge {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .rule-hint-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: 6px;
    background-color: var(--bg-hover-color);
    border: 1px solid var(--border-primary-color);
    font-size: 0.78rem;
    color: var(--fg-secondary-color);
    max-width: 260px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    .rule-name {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rule-lvl {
      font-weight: 700;
      color: var(--fg-accent-color);
      font-size: 0.7rem;
    }
  }
}

.score-streak-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  .streak-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 99px;
    background-color: rgba(230, 126, 34, 0.15);
    color: #e67e22;
    font-weight: 700;
    font-size: 0.8rem;

    .fire-icon {
      font-size: 0.95rem;
      animation: pulse-fire 1s ease-in-out infinite alternate;
    }
  }

  .score-pill {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }
}

.progress-bar-track {
  width: 100%;
  height: 6px;
  border-radius: 99px;
  background-color: var(--bg-hover-color);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--fg-accent-color), var(--fg-success-color));
  border-radius: 99px;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes pulse-fire {
  from {
    transform: scale(0.95);
  }
  to {
    transform: scale(1.15);
  }
}
</style>
