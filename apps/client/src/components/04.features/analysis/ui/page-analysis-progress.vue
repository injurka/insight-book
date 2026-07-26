<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store'

const { t } = useI18n()
const analysisStore = useAnalysisStore()

const percent = computed(() => {
  if (analysisStore.queueTotal === 0)
    return 0

  return Math.round((analysisStore.queueDone / analysisStore.queueTotal) * 100)
})

const isWidgetVisible = computed(() => {
  return (analysisStore.isManualPageAnalysisActive && !analysisStore.isPageAnalysisModalOpen) || analysisStore.isAutoPageAnalysisActive
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="isWidgetVisible" class="background-progress-widget">
      <div class="widget-info">
        <Icon icon="mdi:robot-outline" class="spin-animation" />
        <span class="text">{{ t('analysis.analyzing') || 'Анализ страницы...' }}</span>
        <span class="count">{{ analysisStore.queueDone }} / {{ analysisStore.queueTotal }}</span>

        <button class="cancel-btn" :title="t('common.cancel') || 'Отменить'" @click="analysisStore.cancelPageAnalysis()">
          <Icon icon="mdi:close" />
        </button>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${percent}%` }" />
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.background-progress-widget {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(var(--bg-secondary-color-rgb), 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-secondary-color);
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 300px;
}
.widget-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  color: var(--fg-primary-color);
  font-size: 0.9rem;
  font-weight: 500;

  .count {
    margin-left: auto;
    color: var(--fg-secondary-color);
    font-variant-numeric: tabular-nums;
    margin-right: 4px;
  }

  .cancel-btn {
    background: transparent;
    border: none;
    color: var(--fg-muted-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 50%;
    transition:
      background-color 0.2s,
      color 0.2s;

    &:hover {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-error-color);
    }
  }
}
.progress-bar {
  height: 4px;
  background: var(--bg-tertiary-color);
  border-radius: 2px;
  overflow: hidden;
  .progress-fill {
    height: 100%;
    background: var(--fg-accent-color);
    transition: width 0.3s ease;
  }
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
.spin-animation {
  animation: pulse-op 1.5s linear infinite;
  color: var(--fg-accent-color);
}
@keyframes pulse-op {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
  }
}
</style>
