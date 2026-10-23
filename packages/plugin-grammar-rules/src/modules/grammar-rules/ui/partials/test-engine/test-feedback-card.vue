<script setup lang="ts">
import type { TestResultFeedback } from '../../../../../shared/types'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

interface Props {
  feedback: TestResultFeedback
}

defineProps<Props>()
const { t } = useI18n()
</script>

<template>
  <div
    class="test-feedback-card"
    :class="{ 'is-correct': feedback.isCorrect, 'is-incorrect': !feedback.isCorrect }"
  >
    <!-- Header status -->
    <div class="feedback-header">
      <div class="status-icon-wrapper">
        <Icon
          :icon="feedback.isCorrect ? 'mdi:check-circle' : 'mdi:close-circle'"
          class="status-icon"
        />
      </div>
      <span class="feedback-title">
        {{ feedback.isCorrect ? t('plugins.grammar-rules.correctHeading') : t('plugins.grammar-rules.incorrectHeading') }}
      </span>
    </div>

    <!-- Correct Answer Reveal if missed -->
    <div v-if="!feedback.isCorrect" class="correct-answer-box">
      <span class="label">{{ t('plugins.grammar-rules.correctAnswerIs') }}:</span>
      <span class="value">{{ Array.isArray(feedback.correctAnswer) ? feedback.correctAnswer.join(' ') : feedback.correctAnswer }}</span>
    </div>

    <!-- Distractor specific explanation -->
    <div v-if="feedback.distractorFeedback" class="distractor-feedback-box">
      <Icon icon="mdi:information-outline" class="info-icon" />
      <p class="feedback-text">
        {{ feedback.distractorFeedback }}
      </p>
    </div>

    <!-- Rule general explanation -->
    <div v-if="feedback.explanation" class="general-explanation-box">
      <p class="explanation-text">
        {{ feedback.explanation }}
      </p>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-feedback-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 14px;
  animation: slide-up 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;

  &.is-correct {
    background-color: rgba(46, 204, 113, 0.1);
    border-color: rgba(46, 204, 113, 0.3);

    .status-icon {
      color: var(--fg-success-color);
    }
    .feedback-title {
      color: var(--fg-success-color);
    }
  }

  &.is-incorrect {
    background-color: rgba(231, 76, 60, 0.1);
    border-color: rgba(231, 76, 60, 0.3);

    .status-icon {
      color: var(--fg-error-color);
    }
    .feedback-title {
      color: var(--fg-error-color);
    }
  }
}

.feedback-header {
  display: flex;
  align-items: center;
  gap: 10px;

  .status-icon {
    font-size: 1.5rem;
  }

  .feedback-title {
    font-size: 1.15rem;
    font-weight: 700;
  }
}

.correct-answer-box {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;

  .label {
    font-weight: 600;
    color: var(--fg-secondary-color);
  }

  .value {
    font-weight: 700;
    color: var(--fg-primary-color);
    background-color: var(--bg-primary-color);
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--border-primary-color);
  }
}

.distractor-feedback-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--fg-primary-color);

  .info-icon {
    font-size: 1.1rem;
    color: var(--fg-info-color);
    margin-top: 2px;
    flex-shrink: 0;
  }

  .feedback-text {
    margin: 0;
  }
}

.general-explanation-box {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--fg-secondary-color);

  .explanation-text {
    margin: 0;
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
