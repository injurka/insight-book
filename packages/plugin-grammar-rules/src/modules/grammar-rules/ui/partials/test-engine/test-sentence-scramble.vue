<script setup lang="ts">
import type { SentenceScrambleTest } from '../../../../../shared/types'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'

interface Props {
  test: SentenceScrambleTest
  availableTokens: string[]
  selectedTokens: string[]
  isSubmitted: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'selectToken', index: number): void
  (e: 'removeToken', index: number): void
  (e: 'clearTokens'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="test-sentence-scramble">
    <!-- Translation Prompt -->
    <div class="translation-card">
      <Icon icon="mdi:translate" class="translate-icon" />
      <span class="translation-text">{{ test.translation }}</span>
    </div>

    <!-- User Assembled Slot Box -->
    <div class="tokens-assembled-box" :class="{ 'is-filled': selectedTokens.length > 0 }">
      <span v-if="selectedTokens.length === 0" class="tokens-placeholder">
        {{ t('plugins.grammar-rules.clickTokensToAssemble') }}
      </span>

      <div v-else class="placed-tokens-list">
        <button
          v-for="(tok, idx) in selectedTokens"
          :key="`placed-${idx}-${tok}`"
          type="button"
          class="token-chip placed"
          :disabled="isSubmitted"
          @click="emit('removeToken', idx)"
        >
          <span>{{ tok }}</span>
          <Icon v-if="!isSubmitted" icon="mdi:close" class="remove-icon" />
        </button>
      </div>

      <KitBtn
        v-if="selectedTokens.length > 0 && !isSubmitted"
        size="xs"
        variant="text"
        color="secondary"
        icon="mdi:refresh"
        class="clear-tokens-btn"
        @click="emit('clearTokens')"
      >
        {{ t('plugins.grammar-rules.resetAnswer') }}
      </KitBtn>
    </div>

    <!-- Available Tokens Pool -->
    <div class="tokens-pool-wrapper">
      <div class="tokens-pool">
        <button
          v-for="(tok, idx) in availableTokens"
          :key="`pool-${idx}-${tok}`"
          type="button"
          class="token-chip pool"
          :disabled="isSubmitted"
          @click="emit('selectToken', idx)"
        >
          {{ tok }}
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.test-sentence-scramble {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.translation-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px 20px;
  border-radius: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  text-align: center;

  .translate-icon {
    font-size: 1.25rem;
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }

  .translation-text {
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.tokens-assembled-box {
  min-height: 72px;
  padding: 14px 18px;
  border-radius: 14px;
  border: 2px dashed var(--border-secondary-color);
  background-color: var(--bg-hover-color);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  transition: all 0.2s ease;

  &.is-filled {
    border-style: solid;
    border-color: var(--border-primary-color);
  }

  .tokens-placeholder {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    text-align: center;
    user-select: none;
  }

  .placed-tokens-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .clear-tokens-btn {
    position: absolute;
    right: 8px;
    top: 8px;
  }
}

.tokens-pool-wrapper {
  padding: 12px;
  border-radius: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
}

.tokens-pool {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.token-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border-primary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;

  &:hover:not(:disabled) {
    border-color: var(--fg-accent-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  &.placed {
    background-color: var(--fg-accent-color);
    color: #fff;
    border-color: var(--fg-accent-color);

    .remove-icon {
      font-size: 0.9rem;
      opacity: 0.8;
    }
  }

  &.pool {
    background-color: var(--bg-primary-color);

    &:active {
      transform: scale(0.96);
    }
  }

  &:disabled {
    cursor: default;
    transform: none;
  }
}
</style>
