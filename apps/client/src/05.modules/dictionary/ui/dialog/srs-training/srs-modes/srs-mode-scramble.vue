<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'

interface Props {
  card: UserDictItem
  scrambleChunks: { id: number, text: string }[]
  scrambleAnswer: { id: number, text: string }[]
  isAnswerChecked: boolean
  typoFeedback: string
  isAnswerCorrect: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  chunkClick: [chunk: { id: number, text: string }, from: 'source' | 'answer']
}>()
</script>

<template>
  <div class="scramble-mode">
    <p class="writing-hint">
      {{ $t('dictionary.scrambleTask') }}
    </p>
    <div class="translation-hint" v-html="props.card.translation" />

    <div class="scramble-answer-box">
      <div
        v-for="chunk in props.scrambleAnswer"
        :key="`ans-${chunk.id}`"
        class="scramble-chunk"
        @click="emit('chunkClick', chunk, 'answer')"
      >
        {{ chunk.text }}
      </div>
    </div>

    <div class="scramble-source-box">
      <div
        v-for="chunk in props.scrambleChunks"
        :key="`src-${chunk.id}`"
        class="scramble-chunk"
        @click="emit('chunkClick', chunk, 'source')"
      >
        {{ chunk.text }}
      </div>
    </div>

    <p v-if="props.typoFeedback" class="typo-feedback" :class="{ 'is-typo': !props.isAnswerCorrect }">
      {{ props.typoFeedback }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.scramble-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;

  .writing-hint {
    color: var(--fg-secondary-color);
    margin: 0;
  }

  .translation-hint {
    font-size: 1.15rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }

  .scramble-answer-box {
    min-height: 50px;
    width: 100%;
    max-width: 400px;
    border: 2px dashed var(--border-secondary-color);
    border-radius: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px;
    justify-content: center;
    background: var(--bg-tertiary-color);
  }

  .scramble-source-box {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    max-width: 400px;
  }

  .scramble-chunk {
    padding: 8px 16px;
    background: var(--bg-primary-color);
    border: 1px solid var(--border-primary-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.2rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    user-select: none;
    transition:
      transform 0.1s,
      background-color 0.2s;

    &:hover {
      background: var(--bg-hover-color);
      transform: translateY(-2px);
    }
  }

  .typo-feedback {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-warning-color);
    &.is-typo {
      color: var(--fg-error-color);
    }
  }
}
</style>
