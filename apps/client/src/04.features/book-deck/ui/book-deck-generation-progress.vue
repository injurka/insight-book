<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'

interface Props {
  done: number
  total: number
  current?: string
  running: boolean
  paused: boolean
  retryAttempt?: number
}

const props = withDefaults(defineProps<Props>(), {
  current: '',
  retryAttempt: 0,
})

const emit = defineEmits<{
  pause: []
  cancel: []
}>()

const { t } = useI18n()

const percent = computed(() => {
  if (props.total <= 0)
    return 0

  return Math.min(100, Math.round((props.done / props.total) * 100))
})

const progressWidth = computed(() => `${percent.value}%`)
const isComplete = computed(() => !props.running && props.total > 0 && props.done >= props.total)
const statusIcon = computed(() => {
  if (props.running)
    return 'mdi:loading'

  if (isComplete.value)
    return 'mdi:check-circle-outline'

  return 'mdi:pause-circle-outline'
})
</script>

<template>
  <div
    class="generation-progress"
    :class="{ 'is-running': running, 'is-complete': isComplete }"
    role="status"
    aria-live="polite"
  >
    <div class="progress-header">
      <div class="progress-title">
        <Icon :icon="statusIcon" class="status-icon" :class="{ 'is-spinning': running }" />
        <span>{{ t('bookDeck.progressSummary', { done, total }) }}</span>
      </div>
      <span class="progress-percent">{{ percent }}%</span>
    </div>

    <div
      class="progress-track"
      role="progressbar"
      :aria-valuenow="done"
      :aria-valuemin="0"
      :aria-valuemax="total"
      :aria-label="t('bookDeck.generationProgress')"
    >
      <div class="progress-fill" />
    </div>

    <div v-if="current || (running && retryAttempt > 0) || (!running && !isComplete)" class="progress-meta">
      <span v-if="current" class="current-word-chip">
        <Icon icon="mdi:creation" />
        <span>{{ current }}</span>
      </span>
      <span v-if="running && retryAttempt > 0" class="retry-badge">
        <Icon icon="mdi:refresh" class="is-spinning" />
        <span>{{ t('bookDeck.retryingAi', { attempt: retryAttempt }) }}</span>
      </span>
      <span v-else-if="!running && !isComplete" class="paused-badge">
        {{ t('bookDeck.pausedStatus') }}
      </span>
    </div>

    <div v-if="running" class="progress-actions">
      <KitBtn
        variant="tonal"
        size="sm"
        prepend-icon="mdi:pause"
        :disabled="paused"
        :title="t('bookDeck.pause')"
        @click="emit('pause')"
      >
        {{ t(paused ? 'bookDeck.pausing' : 'bookDeck.pauseShort') }}
      </KitBtn>
      <KitBtn
        variant="outlined"
        color="error"
        size="sm"
        prepend-icon="mdi:close"
        @click="emit('cancel')"
      >
        {{ t('bookDeck.cancel') }}
      </KitBtn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.generation-progress {
  display: grid;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid var(--bg-tertiary-color);
  border-radius: 12px;
  background: var(--bg-primary-color);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.progress-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--fg-primary-color);
  font-size: 0.82rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.status-icon {
  flex: 0 0 auto;
  font-size: 1rem;
  color: var(--fg-accent-color);
}

.is-complete .status-icon {
  color: var(--fg-success-color);
}

.progress-percent {
  flex: 0 0 auto;
  font-size: 0.8rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--fg-accent-color);
}

.is-complete .progress-percent {
  color: var(--fg-success-color);
}

.progress-track {
  position: relative;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--fg-accent-color) 14%, var(--bg-tertiary-color));
  overflow: hidden;
}

.progress-fill {
  position: relative;
  width: v-bind(progressWidth);
  height: 100%;
  border-radius: inherit;
  background: var(--fg-accent-color);
  transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden;
}

.is-running .progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.28) 50%, transparent 100%);
  animation: progress-shimmer 1.6s ease-in-out infinite;
}

.is-complete .progress-fill {
  background: var(--fg-success-color);
}

.progress-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.current-word-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-accent-color);
  color: var(--fg-primary-color);
  font-size: 0.74rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.current-word-chip > :first-child {
  flex: 0 0 auto;
  color: var(--fg-accent-color);
}

.retry-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--fg-warning-color, #d97706) 35%, transparent);
  background: color-mix(in srgb, var(--fg-warning-color, #d97706) 12%, var(--bg-primary-color));
  color: var(--fg-warning-color, #b45309);
  font-size: 0.72rem;
  font-weight: 500;
}

.paused-badge {
  color: var(--fg-secondary-color);
  font-size: 0.74rem;
}

.progress-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

.progress-actions :deep(button) {
  height: auto;
  min-height: 36px;
  font-size: 0.76rem;
  border-radius: 8px;
}

.is-spinning {
  animation: progress-spin 1s linear infinite;
}

@keyframes progress-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes progress-shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@media (max-width: 680px) {
  .generation-progress {
    padding: 14px;
    gap: 10px;
  }

  .progress-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .progress-actions :deep(button) {
    width: 100%;
    min-height: 38px;
  }
}
</style>
