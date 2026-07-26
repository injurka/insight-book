<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/components/01.kit'
import OnboardingStepLayout from './onboarding-step-layout.vue'

const emit = defineEmits<{
  finish: []
}>()
const { t } = useI18n()
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step8_title')"
    :description="t('onboarding.step8_desc')"
    icon="mdi:rocket-launch"
    wrapper-class="pulse-shadow"
    icon-class="accent-icon"
  >
    <div class="final-card">
      <div class="benefits-list">
        <div class="benefit-item">
          <Icon icon="mdi:infinity" class="benefit-icon" />
          <span>Высокие лимиты на ИИ</span>
        </div>
        <div class="benefit-item">
          <Icon icon="mdi:star" class="benefit-icon" />
          <span>Эксклюзивные функции</span>
        </div>
        <div class="benefit-item">
          <Icon icon="mdi:bug-outline" class="benefit-icon warning" />
          <span>Возможны баги (мы чиним!)</span>
        </div>
      </div>
    </div>

    <KitBtn
      color="primary"
      size="lg"
      class="finish-btn pulse-btn"
      @click="emit('finish')"
    >
      {{ t('onboarding.step8_action') }} <Icon icon="mdi:arrow-right" />
    </KitBtn>
  </OnboardingStepLayout>
</template>

<style lang="scss" scoped>
:deep(.accent-icon) {
  color: var(--fg-accent-color) !important;
}

:deep(.pulse-shadow) {
  box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0.4);
  animation: pulse-shadow-anim 2s infinite;
}

.final-card {
  width: 100%;
  max-width: 400px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 32px;
}

.benefits-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.1rem;
  color: var(--fg-primary-color);

  .benefit-icon {
    font-size: 1.5rem;
    color: var(--fg-success-color);

    &.warning {
      color: var(--fg-warning-color);
    }
  }
}

.finish-btn {
  font-size: 1.2rem;
  padding: 16px 40px;
  border-radius: 99px;
  font-weight: bold;
}

.pulse-btn {
  box-shadow: 0 0 0 0 rgba(var(--bg-primary-color-rgb, 255, 255, 255), 0.4);
  animation: pulse-btn-anim 2s infinite;
}

@keyframes pulse-shadow-anim {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0.6);
  }
  70% {
    box-shadow: 0 0 0 20px rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0);
  }
}

@keyframes pulse-btn-anim {
  0% {
    box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0.4);
  }
  70% {
    box-shadow: 0 0 0 16px rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0);
  }
}
</style>
