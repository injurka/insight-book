<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { useSrsQuiz } from '../../../composables/use-srs-quiz'
import { useTrainingStore } from '../../../store/training.store'

defineOptions({
  inheritAttrs: false,
})

defineProps<Props>()

const emit = defineEmits(['close'])

interface Props {
  stats: { newStudied: number, reviewed: number }
  accuracy: number
  timeSpentMs: number
}

const trainingStore = useTrainingStore()
const { formatTime } = useSrsQuiz()
const { t } = useI18n()
</script>

<template>
  <div class="finished-state">
    <h2>{{ t('dictionary.greatJob') }}</h2>
    <p v-if="trainingStore.trainingMode === 'srs'">
      {{ t('dictionary.reviewedAll') }}
    </p>
    <p v-else>
      {{ t('dictionary.warmupFinished') }}
    </p>

    <div class="summary-stats">
      <div class="stat-box">
        <Icon icon="mdi:star-four-points-outline" class="stat-icon new" />
        <span class="stat-val">{{ stats.newStudied }}</span>
        <span class="stat-name">{{ t('dictionary.newStudied') }}</span>
      </div>
      <div class="stat-box">
        <Icon icon="mdi:refresh" class="stat-icon review" />
        <span class="stat-val">{{ stats.reviewed }}</span>
        <span class="stat-name">{{ t('dictionary.reviewed') }}</span>
      </div>
      <div class="stat-box">
        <Icon icon="mdi:bullseye-arrow" class="stat-icon accuracy" />
        <span class="stat-val">{{ accuracy }}%</span>
        <span class="stat-name">{{ t('dictionary.accuracy') }}</span>
      </div>
      <div class="stat-box">
        <Icon icon="mdi:clock-outline" class="stat-icon time" />
        <span class="stat-val">{{ formatTime(timeSpentMs) }}</span>
        <span class="stat-name">{{ t('dictionary.time') }}</span>
      </div>
    </div>

    <KitBtn color="primary" size="lg" @click="emit('close')">
      {{ t('dictionary.finishSession') }}
    </KitBtn>
  </div>
</template>

<style lang="scss" scoped>
.finished-state {
  text-align: center;
  padding: 40px 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;

  h2 {
    margin-bottom: 12px;
  }
  p {
    color: var(--fg-secondary-color);
  }

  .summary-stats {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin: 24px 0 32px 0;
    flex-wrap: wrap;

    .stat-box {
      background: var(--bg-secondary-color);
      border: 1px solid var(--border-secondary-color);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 100px;
      gap: 8px;

      .stat-icon {
        font-size: 2rem;
        &.new {
          color: var(--fg-info-color);
        }
        &.review {
          color: var(--fg-accent-color);
        }
        &.accuracy {
          color: var(--fg-success-color);
        }
        &.time {
          color: var(--fg-warning-color);
        }
      }

      .stat-val {
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--fg-primary-color);
      }

      .stat-name {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}
</style>
