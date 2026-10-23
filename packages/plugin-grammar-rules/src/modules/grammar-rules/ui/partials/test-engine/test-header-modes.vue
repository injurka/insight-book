<script setup lang="ts">
import type { Rule } from '../../../../shared/types'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'

interface SrsStats {
  masteredCount: number
  learningCount: number
  reviewCount: number
  newCount: number
}

interface Props {
  mode: 'all' | 'srs' | 'mistakes'
  allCount: number
  srsDueCount: number
  mistakesCount: number
  stats: SrsStats
  targetRule?: Rule | null
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'changeMode', mode: 'all' | 'srs' | 'mistakes'): void
  (e: 'clearTargetRule'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="test-header-modes">
    <!-- Active Rule Focus Banner -->
    <div v-if="targetRule" class="target-rule-banner">
      <div class="target-rule-info">
        <Icon icon="mdi:target" class="target-icon" />
        <span class="target-rule-text">
          {{ t('plugins.grammar-rules.practiceTargetRuleHint', { title: targetRule.title }) }}
        </span>
      </div>
      <KitBtn
        size="xs"
        variant="text"
        icon="mdi:close"
        @click="emit('clearTargetRule')"
      >
        {{ t('plugins.grammar-rules.clearRuleFilter') }}
      </KitBtn>
    </div>

    <!-- Mode Chips & SRS Stats -->
    <div class="modes-row">
      <div class="modes-track">
        <button
          type="button"
          class="mode-chip"
          :class="{ active: mode === 'all' }"
          @click="emit('changeMode', 'all')"
        >
          <Icon icon="mdi:format-list-bulleted" />
          <span>{{ t('plugins.grammar-rules.modeAll') }}</span>
          <span class="chip-badge">{{ allCount }}</span>
        </button>

        <button
          type="button"
          class="mode-chip"
          :class="{
            'active': mode === 'srs',
            'has-due': srsDueCount > 0,
          }"
          @click="emit('changeMode', 'srs')"
        >
          <Icon icon="mdi:calendar-clock" />
          <span>{{ t('plugins.grammar-rules.modeSrs') }}</span>
          <span class="chip-badge" :class="{ 'badge-accent': srsDueCount > 0 }">{{ srsDueCount }}</span>
        </button>

        <button
          type="button"
          class="mode-chip"
          :class="{ active: mode === 'mistakes', disabled: mistakesCount === 0 }"
          :disabled="mistakesCount === 0"
          @click="emit('changeMode', 'mistakes')"
        >
          <Icon icon="mdi:alert-circle-outline" />
          <span>{{ t('plugins.grammar-rules.modeMistakes') }}</span>
          <span class="chip-badge" :class="{ 'badge-error': mistakesCount > 0 }">{{ mistakesCount }}</span>
        </button>
      </div>

      <!-- Quick SRS Summary -->
      <div class="srs-summary">
        <div class="stat-pill mastered" :title="t('plugins.grammar-rules.statMastered')">
          <Icon icon="mdi:check-decagram" />
          <span>{{ stats.masteredCount }}</span>
        </div>
        <div class="stat-pill learning" :title="t('plugins.grammar-rules.statLearning')">
          <Icon icon="mdi:trending-up" />
          <span>{{ stats.learningCount + stats.reviewCount }}</span>
        </div>
        <div class="stat-pill new" :title="t('plugins.grammar-rules.statNew')">
          <Icon icon="mdi:star-outline" />
          <span>{{ stats.newCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-header-modes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.target-rule-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background-color: var(--bg-hover-color);
  border: 1px solid var(--fg-accent-color);
  border-radius: 10px;
  gap: 8px;

  .target-rule-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    min-width: 0;

    .target-icon {
      color: var(--fg-accent-color);
      font-size: 1.15rem;
      flex-shrink: 0;
    }

    .target-rule-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.modes-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
  }
}

.modes-track {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--bg-secondary-color);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid var(--border-primary-color);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover:not(:disabled) {
    color: var(--fg-primary-color);
    background-color: var(--bg-hover-color);
  }

  &.active {
    background-color: var(--bg-primary-color);
    color: var(--fg-primary-color);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  &.disabled,
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .chip-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    height: 18px;
    min-width: 18px;
    border-radius: 99px;
    font-size: 0.75rem;
    font-weight: 700;
    background-color: var(--bg-hover-color);
    color: var(--fg-secondary-color);

    &.badge-accent {
      background-color: var(--fg-accent-color);
      color: #fff;
    }

    &.badge-error {
      background-color: var(--fg-error-color);
      color: #fff;
    }
  }
}

.srs-summary {
  display: flex;
  align-items: center;
  gap: 8px;

  @include media-down(sm) {
    justify-content: flex-end;
  }
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid var(--border-primary-color);
  background-color: var(--bg-secondary-color);

  &.mastered {
    color: var(--fg-success-color);
    border-color: rgba(46, 204, 113, 0.3);
  }

  &.learning {
    color: var(--fg-warning-color);
    border-color: rgba(241, 196, 15, 0.3);
  }

  &.new {
    color: var(--fg-secondary-color);
  }
}
</style>
