<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import OnboardingStepLayout from './onboarding-step-layout.vue'

const emit = defineEmits<{
  next: []
}>()
const { t } = useI18n()
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step0_title')"
    :description="t('onboarding.step0_desc')"
    icon="mdi:book-open-page-variant"
    wrapper-class="pulse-book"
    @click="emit('next')"
  >
    <div class="hint-action blink" @click="emit('next')">
      <Icon icon="mdi:gesture-tap" />
      <span>{{ t('onboarding.step0_action') }}</span>
    </div>
  </OnboardingStepLayout>
</template>

<style lang="scss" scoped>
.hint-action {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-tertiary-color);
  font-size: 0.95rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 16px;

  svg {
    font-size: 1.4rem;
  }
}

:deep(.pulse-book) {
  cursor: pointer;
  border-color: var(--fg-accent-color);
  box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0.4);
  animation: pulse-border 2s infinite;

  &:hover {
    transform: scale(1.05);
  }
}

@keyframes pulse-border {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0.4);
  }
  70% {
    box-shadow: 0 0 0 20px rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0);
  }
}

.blink {
  animation: blink-anim 2s infinite;
}

@keyframes blink-anim {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}
</style>
