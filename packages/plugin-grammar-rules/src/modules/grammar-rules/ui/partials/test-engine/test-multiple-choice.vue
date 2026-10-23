<script setup lang="ts">
import type { ClozeChoiceTest, MultipleChoiceOption, MultipleChoiceTest } from '../../../../shared/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

interface Props {
  test: MultipleChoiceTest | ClozeChoiceTest
  selectedOption: string | null
  isSubmitted: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'select', optionText: string): void
}>()

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F']

const optionsList = computed(() => {
  if (!props.test.options)
    return []

  return (props.test.options as Array<string | MultipleChoiceOption>).map((opt, idx) => {
    const text = typeof opt === 'object' && opt !== null ? opt.text : String(opt)

    return {
      text,
      letter: optionLetters[idx] || String(idx + 1),
      isCorrectAnswer: text === props.test.correctAnswer,
    }
  })
})

const clozeSentence = computed(() => {
  if ('sentenceWithBlank' in props.test) {
    return props.test.sentenceWithBlank
  }

  return null
})
</script>

<template>
  <div class="test-multiple-choice">
    <!-- Cloze sentence highlight if cloze_choice -->
    <div v-if="clozeSentence" class="cloze-sentence-banner">
      <span class="sentence-text">{{ clozeSentence }}</span>
    </div>

    <!-- Options Grid -->
    <div class="options-grid">
      <button
        v-for="opt in optionsList"
        :key="opt.text"
        type="button"
        class="option-card"
        :class="{
          'is-selected': selectedOption === opt.text,
          'is-correct': isSubmitted && opt.isCorrectAnswer,
          'is-incorrect': isSubmitted && selectedOption === opt.text && !opt.isCorrectAnswer,
          'is-disabled': isSubmitted,
        }"
        :disabled="isSubmitted"
        @click="emit('select', opt.text)"
      >
        <span class="option-letter">{{ opt.letter }}</span>
        <span class="option-text">{{ opt.text }}</span>

        <span class="option-status">
          <Icon
            v-if="isSubmitted && opt.isCorrectAnswer"
            icon="mdi:check-circle"
            class="status-icon success"
          />
          <Icon
            v-else-if="isSubmitted && selectedOption === opt.text && !opt.isCorrectAnswer"
            icon="mdi:close-circle"
            class="status-icon error"
          />
        </span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-multiple-choice {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.cloze-sentence-banner {
  padding: 16px 20px;
  border-radius: 12px;
  background-color: var(--bg-hover-color);
  border: 1px dashed var(--border-secondary-color);
  text-align: center;

  .sentence-text {
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.5;
    color: var(--fg-primary-color);
  }
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

.option-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background-color: var(--bg-secondary-color);
  border: 1.5px solid var(--border-primary-color);
  color: var(--fg-primary-color);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 52px;

  &:hover:not(:disabled) {
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  &.is-selected {
    border-color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
    box-shadow: 0 0 0 2px rgba(var(--fg-accent-color-rgb, 120, 100, 240), 0.2);

    .option-letter {
      background-color: var(--fg-accent-color);
      color: #fff;
    }
  }

  &.is-correct {
    border-color: var(--fg-success-color) !important;
    background-color: rgba(46, 204, 113, 0.12) !important;

    .option-letter {
      background-color: var(--fg-success-color) !important;
      color: #fff !important;
    }
  }

  &.is-incorrect {
    border-color: var(--fg-error-color) !important;
    background-color: rgba(231, 76, 60, 0.12) !important;

    .option-letter {
      background-color: var(--fg-error-color) !important;
      color: #fff !important;
    }
  }

  &.is-disabled {
    cursor: default;
  }

  .option-letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background-color: var(--bg-hover-color);
    border: 1px solid var(--border-primary-color);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--fg-secondary-color);
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .option-text {
    flex: 1;
    overflow-wrap: break-word;
  }

  .option-status {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    .status-icon {
      font-size: 1.25rem;

      &.success {
        color: var(--fg-success-color);
      }

      &.error {
        color: var(--fg-error-color);
      }
    }
  }
}
</style>
