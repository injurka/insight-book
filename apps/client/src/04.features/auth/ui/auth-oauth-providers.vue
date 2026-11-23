<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  isLoading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'loginYandex'): void
}>()

const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="yandex-btn"
    :disabled="props.isLoading"
    @click="emit('loginYandex')"
  >
    <span class="yandex-btn-inner">
      <span class="yandex-icon-wrap">
        <span class="yandex-letter">Я</span>
      </span>
      <span class="yandex-btn-label">{{ t('signIn.yandexLogin') }}</span>
    </span>
  </button>
</template>

<style scoped>
.yandex-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
  width: 100%;
  height: 52px;
  border-radius: 14px;
  padding: 0;
  background: linear-gradient(135deg, #fc3f1d 0%, #d4320f 100%);
  border: none;
  box-shadow: 0 4px 20px rgba(252, 63, 29, 0.3);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (hover: hover) and (pointer: fine) {
  .yandex-btn:hover:not(:disabled) {
    box-shadow: 0 8px 28px rgba(252, 63, 29, 0.45);
    background: linear-gradient(135deg, #ff4d27 0%, #e0381a 100%);
  }
}

.yandex-btn:active:not(:disabled) {
  transform: translateY(0);
}

.yandex-btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.yandex-btn-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
}

.yandex-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: white;
  flex-shrink: 0;
}

.yandex-letter {
  font:
    bold 1.3rem Arial,
    sans-serif;
}

.yandex-btn-label {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  letter-spacing: 0.1px;
}
</style>
