<script setup lang="ts">
import type { UserDictItem } from '~/01.shared/types/models'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitInput } from '~/02.kit/atoms/kit-input/ui'

interface Props {
  card: UserDictItem
  typedAnswer: string
  isAnswerChecked: boolean
  typoFeedback: string
  isAnswerCorrect: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:typedAnswer': [value: string]
  'submit': []
}>()
</script>

<template>
  <div class="typing-mode">
    <div class="translation-hint" v-html="props.card.translation" />
    <div class="typing-area">
      <KitInput
        :model-value="props.typedAnswer"
        :placeholder="$t('dictionary.writeWord')"
        :disabled="props.isAnswerChecked"
        @update:model-value="emit('update:typedAnswer', $event as string)"
        @keyup.enter="emit('submit')"
      />
      <KitBtn color="primary" :disabled="!props.typedAnswer || props.isAnswerChecked" @click="emit('submit')">
        {{ $t('dictionary.check') }}
      </KitBtn>
    </div>
    <p v-if="props.typoFeedback" class="typo-feedback" :class="{ 'is-typo': !props.isAnswerCorrect }">
      {{ props.typoFeedback }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.typing-mode {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .translation-hint {
    font-size: 1.3rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }

  .typing-area {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 400px;

    :deep(.kit-input-wrapper) {
      flex: 1;
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
