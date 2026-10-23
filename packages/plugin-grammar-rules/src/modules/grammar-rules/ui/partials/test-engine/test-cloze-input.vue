<script setup lang="ts">
import type { ClozeInputTest } from '../../../../../shared/types'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitInput } from '~/02.kit'

interface Props {
  test: ClozeInputTest
  isSubmitted: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'submit'): void
}>()
const typedInput = defineModel<string>('typedInput', { required: true })

const { t } = useI18n()
</script>

<template>
  <div class="test-cloze-input">
    <div class="cloze-sentence-card">
      <span class="sentence-text">{{ test.sentenceWithBlank }}</span>
    </div>

    <div class="input-form">
      <KitInput
        v-model="typedInput"
        :placeholder="t('plugins.grammar-rules.typeAnswerPlaceholder')"
        :disabled="isSubmitted"
        class="answer-input"
        @keydown.enter="emit('submit')"
      />
    </div>

    <div v-if="test.hints && test.hints.length > 0" class="hints-box">
      <Icon icon="mdi:lightbulb-outline" class="hint-icon" />
      <span class="hint-label">{{ t('plugins.grammar-rules.hintLabel') }}:</span>
      <span class="hint-text">{{ test.hints.join(' • ') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-cloze-input {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.cloze-sentence-card {
  padding: 20px 24px;
  border-radius: 14px;
  background-color: var(--bg-hover-color);
  border: 1px dashed var(--border-secondary-color);
  text-align: center;

  .sentence-text {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.6;
    color: var(--fg-primary-color);
  }
}

.input-form {
  max-width: 480px;
  width: 100%;
  margin: 0 auto;

  .answer-input {
    width: 100%;

    :deep(input) {
      font-size: 1.1rem;
      text-align: center;
      padding: 12px 16px;
      height: 48px;
    }
  }
}

.hints-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  background-color: var(--bg-secondary-color);
  padding: 8px 14px;
  border-radius: 8px;
  align-self: center;

  .hint-icon {
    color: var(--fg-warning-color);
    font-size: 1.1rem;
  }

  .hint-label {
    font-weight: 600;
  }
}
</style>
