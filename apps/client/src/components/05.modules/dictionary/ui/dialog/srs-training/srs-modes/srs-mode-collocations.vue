<script setup lang="ts">
const props = defineProps<{
  deepDiveData: {
    question: string
    translation: string
    options: string[]
    answer: string
  }
  choiceOptions: { text: string, isCorrect: boolean }[]
  isAnswerChecked: boolean
  selectedChoice: string | null
}>()

const emit = defineEmits<{
  select: [option: { text: string, isCorrect: boolean }]
}>()
</script>

<template>
  <div class="collocations-mode">
    <p class="writing-hint">
      {{ $t('dictionary.collocationsTask') }}
    </p>
    <div class="collocation-question">
      {{ props.deepDiveData.question }}
    </div>
    <div class="translation-hint">
      {{ props.deepDiveData.translation }}
    </div>
    <div class="options-grid">
      <button
        v-for="opt in props.choiceOptions"
        :key="opt.text"
        class="choice-btn"
        :class="{
          'is-correct': props.isAnswerChecked && opt.isCorrect,
          'is-wrong': props.isAnswerChecked && props.selectedChoice === opt.text && !opt.isCorrect,
          'is-disabled': props.isAnswerChecked,
        }"
        :disabled="props.isAnswerChecked"
        @click="emit('select', opt)"
      >
        {{ opt.text }}
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.collocations-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;

  .writing-hint {
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .collocation-question {
    font-size: 2rem;
    font-weight: bold;
    color: var(--fg-primary-color);
  }

  .translation-hint {
    font-size: 1.1rem;
    color: var(--fg-secondary-color);
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
    max-width: 500px;

    @include media-down(sm) {
      grid-template-columns: 1fr;
    }

    .choice-btn {
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border-primary-color);
      background: var(--bg-secondary-color);
      color: var(--fg-primary-color);
      font-size: 1.05rem;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        background: var(--bg-hover-color);
        border-color: var(--fg-accent-color);
      }

      &.is-correct {
        background: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.2);
        border-color: var(--fg-success-color);
        color: var(--fg-success-color);
        font-weight: bold;
      }

      &.is-wrong {
        background: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.2);
        border-color: var(--fg-error-color);
        color: var(--fg-error-color);
        text-decoration: line-through;
      }

      &:disabled {
        cursor: default;
        opacity: 0.7;
      }
    }
  }
}
</style>
