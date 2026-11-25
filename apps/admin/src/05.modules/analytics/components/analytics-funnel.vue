<script setup lang="ts">
import type { FunnelStepMetric } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'

interface Props {
  steps: FunnelStepMetric[]
  compact?: boolean
}

withDefaults(defineProps<Props>(), {
  compact: false,
})
</script>

<template>
  <section class="funnel-card" :class="{ 'funnel-card--compact': compact }">
    <div class="funnel-card__header">
      <div class="funnel-card__title-wrap">
        <Icon icon="mdi:filter-variant" class="funnel-card__title-icon" />
        <div>
          <h2 class="funnel-card__title">
            Воронка активации
          </h2>
          <p v-if="!compact" class="funnel-card__subtitle">
            Путь пользователя от регистрации до регулярного возвращения
          </p>
        </div>
      </div>
      <slot name="header-action" />
    </div>

    <div class="funnel-list">
      <div
        v-for="(step, idx) in steps"
        :key="step.key"
        class="funnel-step"
        :title="step.description"
      >
        <div class="funnel-step__meta">
          <div class="funnel-step__left">
            <span class="funnel-step__index">{{ idx + 1 }}</span>
            <div class="funnel-step__texts">
              <span class="funnel-step__label">{{ step.label }}</span>
              <span v-if="!compact" class="funnel-step__desc">{{ step.description }}</span>
            </div>
          </div>

          <div class="funnel-step__right">
            <span v-if="idx > 0" class="funnel-step__conv" title="Конверсия с предыдущего шага">
              <Icon icon="mdi:arrow-right-thin" class="funnel-step__conv-icon" />
              {{ step.conversionFromPrev }}%
            </span>
            <span class="funnel-step__count">{{ step.count }}</span>
            <span class="funnel-step__pct">{{ step.percentOfTotal }}%</span>
          </div>
        </div>

        <div class="funnel-step__track">
          <div
            class="funnel-step__fill"
            :style="{ width: `${Math.max(step.percentOfTotal, step.count > 0 ? 3 : 0)}%` }"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.funnel-card {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 20px 22px;
}

.funnel-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.funnel-card__title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.funnel-card__title-icon {
  font-size: 22px;
  color: var(--fg-accent-color, #4b8266);
  margin-top: 1px;
  flex-shrink: 0;
}

.funnel-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
  line-height: 1.3;
}

.funnel-card__subtitle {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  margin: 3px 0 0;
}

.funnel-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.funnel-card--compact .funnel-list {
  gap: 10px;
}

.funnel-step {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.funnel-step__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.funnel-step__left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.funnel-step__index {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-primary-color, #c7c0b6);
  color: var(--fg-secondary-color, #8e867b);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.funnel-step__texts {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.funnel-step__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  line-height: 1.25;
}

.funnel-step__desc {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.funnel-step__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.funnel-step__conv {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  font-size: 11px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 999px;
  padding: 2px 8px 2px 5px;
}

.funnel-step__conv-icon {
  font-size: 14px;
}

.funnel-step__count {
  font-size: 15px;
  font-weight: 700;
  color: var(--fg-primary-color, #4a443c);
  min-width: 28px;
  text-align: right;
}

.funnel-step__pct {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-accent-color, #4b8266);
  min-width: 38px;
  text-align: right;
}

.funnel-step__track {
  height: 10px;
  border-radius: 999px;
  background: var(--bg-primary-color, #f3efe9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  overflow: hidden;
}

.funnel-step__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4b8266 0%, #6ea588 100%);
  transition: width 0.35s ease;
}
</style>
