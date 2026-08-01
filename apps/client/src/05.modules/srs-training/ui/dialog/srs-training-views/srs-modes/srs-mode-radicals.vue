<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { KitBtn } from '~/02.kit'

interface Props {
  card: UserDictItem
  deepDiveData: {
    options: string[]
    answer: string[]
  }
  selectedRadicals: string[]
  isAnswerChecked: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleRadical: [radical: string]
  check: []
}>()
</script>

<template>
  <div class="radicals-mode">
    <p class="writing-hint">
      {{ $t('dictionary.radicalsTask') }}
    </p>
    <div class="word-huge">
      {{ props.card.word }}
    </div>

    <div class="radicals-grid">
      <button
        v-for="opt in props.deepDiveData.options"
        :key="opt"
        class="radical-btn"
        :class="{
          'is-selected': props.selectedRadicals.includes(opt),
          'is-correct': props.isAnswerChecked && props.deepDiveData.answer.includes(opt),
          'is-wrong': props.isAnswerChecked && props.selectedRadicals.includes(opt) && !props.deepDiveData.answer.includes(opt),
          'is-disabled': props.isAnswerChecked,
        }"
        @click="emit('toggleRadical', opt)"
      >
        {{ opt }}
      </button>
    </div>

    <KitBtn
      color="primary"
      class="check-btn"
      :disabled="props.selectedRadicals.length === 0 || props.isAnswerChecked"
      @click="emit('check')"
    >
      {{ $t('dictionary.check') }}
    </KitBtn>
  </div>
</template>

<style lang="scss" scoped>
.radicals-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;

  .writing-hint {
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .radicals-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    max-width: 400px;

    .radical-btn {
      padding: 12px 20px;
      font-size: 1.5rem;
      border: 1px solid var(--border-primary-color);
      border-radius: 8px;
      background: var(--bg-secondary-color);
      color: var(--fg-primary-color);
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(.is-disabled) {
        border-color: var(--fg-accent-color);
      }

      &.is-selected {
        background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.2);
        border-color: var(--fg-accent-color);
      }

      &.is-correct {
        background: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.2);
        border-color: var(--fg-success-color);
        color: var(--fg-success-color);
      }

      &.is-wrong {
        background: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.2);
        border-color: var(--fg-error-color);
        color: var(--fg-error-color);
        text-decoration: line-through;
      }
    }
  }
}

.word-huge {
  font-size: 3rem;
  font-weight: bold;
  color: var(--fg-primary-color);
}

.check-btn {
  margin-top: 16px;
}
</style>
