<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'

interface Props {
  mode: 'all' | 'srs' | 'mistakes'
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'switchMode', mode: 'all'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="test-empty-state">
    <div class="empty-icon-wrapper">
      <Icon icon="mdi:check-circle-outline" class="empty-icon" />
    </div>

    <h3 class="empty-title">
      {{ mode === 'mistakes' ? t('plugins.grammar-rules.noMistakes') : t('plugins.grammar-rules.noTestsDue') }}
    </h3>

    <p class="empty-hint">
      {{ t('plugins.grammar-rules.switchModeHint') }}
    </p>

    <KitBtn
      v-if="mode !== 'all'"
      variant="tonal"
      color="accent"
      size="md"
      icon="mdi:format-list-bulleted"
      @click="emit('switchMode', 'all')"
    >
      {{ t('plugins.grammar-rules.modeAll') }}
    </KitBtn>
  </div>
</template>

<style lang="scss" scoped>
.test-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
  text-align: center;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 20px;
  gap: 16px;
  max-width: 520px;
  margin: 32px auto;

  .empty-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: rgba(46, 204, 113, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-success-color);

    .empty-icon {
      font-size: 2.2rem;
    }
  }

  .empty-title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .empty-hint {
    margin: 0;
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    max-width: 360px;
    line-height: 1.5;
  }
}
</style>
