<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'loginYandex'): void
}>()

const { t } = useI18n()
</script>

<template>
  <a
    href="#"
    class="yandex-btn yandex-btn-link"
    :class="{ 'is-disabled': props.isLoading }"
    @click.prevent="emit('loginYandex')"
  >
    <span class="yandex-btn-inner">
      <span class="yandex-icon-wrap">
        <span style="font-family: Arial, sans-serif; font-weight: bold; font-size: 1.3rem;">Я</span>
      </span>
      <span class="yandex-btn-label">{{ t('signIn.yandexLogin') }}</span>
    </span>
  </a>
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

.yandex-btn:hover:not(.is-disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(252, 63, 29, 0.45);
  background: linear-gradient(135deg, #ff4d27 0%, #e0381a 100%);
}

.yandex-btn:active:not(.is-disabled) {
  transform: translateY(0);
}

.yandex-btn.is-disabled {
  opacity: 0.7;
  pointer-events: none;
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

.yandex-btn-label {
  font-size: 1rem;
  font-weight: 600;
  color: white;
  letter-spacing: 0.1px;
}
</style>
