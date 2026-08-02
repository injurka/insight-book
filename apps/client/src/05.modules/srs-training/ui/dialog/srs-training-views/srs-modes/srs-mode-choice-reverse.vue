<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { computed } from 'vue'

interface Props {
  card: UserDictItem
  choiceOptions: { text: string, isCorrect: boolean }[]
  isAnswerChecked: boolean
  selectedChoice: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [option: { text: string, isCorrect: boolean }]
}>()

const promptText = computed(() => {
  if (!props.card.translation)
    return ''

  return props.card.translation.split(',')[0].split(';')[0].replace(/<[^>]+(>|$)/g, '').trim()
})
</script>

<template>
  <div class="choice-mode">
    <div class="prompt-text">
      {{ promptText }}
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
        <span class="choice-text">{{ opt.text }}</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.choice-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;

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
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;

      .choice-text {
        font-size: 1.5rem;
        font-weight: 500;
        font-family: 'Maple Mono CN', sans-serif;
      }

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

.prompt-text {
  font-size: 2rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  text-align: center;
  padding: 0 20px;
}
</style>
