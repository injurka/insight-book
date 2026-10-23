<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'

interface Props {
  score: number
  total: number
  mistakesCount: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'restart'): void
  (e: 'reviewMistakes'): void
  (e: 'backToRules'): void
}>()

const { t } = useI18n()

const percent = computed(() => {
  if (props.total <= 0)
    return 100

  return Math.round((props.score / props.total) * 100)
})

const isGreatResult = computed(() => percent.value >= 80)
</script>

<template>
  <div class="test-round-summary">
    <div class="trophy-badge" :class="{ 'is-great': isGreatResult }">
      <Icon :icon="isGreatResult ? 'mdi:trophy' : 'mdi:trophy-outline'" class="trophy-icon" />
    </div>

    <h2 class="round-title">
      {{ t('plugins.grammar-rules.roundComplete') }}
    </h2>

    <p class="round-result">
      {{ t('plugins.grammar-rules.roundResult', { score, total, percent }) }}
    </p>

    <!-- Visual percent bar -->
    <div class="summary-progress-wrapper">
      <div class="summary-progress-bar">
        <div class="summary-progress-fill" :style="{ width: `${percent}%` }" />
      </div>
      <span class="percent-label">{{ percent }}%</span>
    </div>

    <!-- Actions -->
    <div class="summary-actions">
      <KitBtn
        color="accent"
        size="md"
        icon="mdi:refresh"
        @click="emit('restart')"
      >
        {{ t('plugins.grammar-rules.startNextRound') }}
      </KitBtn>

      <KitBtn
        v-if="mistakesCount > 0"
        variant="tonal"
        color="error"
        size="md"
        icon="mdi:alert-circle-outline"
        @click="emit('reviewMistakes')"
      >
        {{ t('plugins.grammar-rules.reviewMistakesCount', { count: mistakesCount }) }}
      </KitBtn>

      <KitBtn
        variant="outlined"
        color="secondary"
        size="md"
        icon="mdi:book-open-page-variant-outline"
        @click="emit('backToRules')"
      >
        {{ t('plugins.grammar-rules.backToRules') }}
      </KitBtn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-round-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 20px;
  gap: 16px;
  max-width: 560px;
  width: 100%;
  margin: 24px auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}

.trophy-badge {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: rgba(var(--fg-accent-color-rgb, 120, 100, 240), 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-accent-color);

  &.is-great {
    background-color: rgba(241, 196, 15, 0.15);
    color: #f1c40f;
    animation: bounce-trophy 1.2s ease-in-out infinite alternate;
  }

  .trophy-icon {
    font-size: 2.5rem;
  }
}

.round-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--fg-primary-color);
}

.round-result {
  margin: 0;
  font-size: 1.05rem;
  color: var(--fg-secondary-color);
}

.summary-progress-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 320px;
  margin: 8px 0;

  .summary-progress-bar {
    flex: 1;
    height: 8px;
    border-radius: 99px;
    background-color: var(--bg-hover-color);
    overflow: hidden;

    .summary-progress-fill {
      height: 100%;
      border-radius: 99px;
      background: linear-gradient(90deg, var(--fg-accent-color), var(--fg-success-color));
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  .percent-label {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    width: 44px;
    text-align: right;
  }
}

.summary-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 320px;
  margin-top: 12px;

  :deep(.kit-btn) {
    width: 100%;
    justify-content: center;
  }
}

@keyframes bounce-trophy {
  from {
    transform: scale(0.96) rotate(-2deg);
  }
  to {
    transform: scale(1.06) rotate(2deg);
  }
}
</style>
