<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/components/01.kit'
import OnboardingStepLayout from './onboarding-step-layout.vue'

const emit = defineEmits<{
  next: []
}>()
const { t } = useI18n()
const isOffline = ref(false)

function toggleOffline() {
  isOffline.value = true
}
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step6_title')"
    :description="t('onboarding.step6_desc')"
    icon="mdi:wifi-off"
    :icon-class="isOffline ? 'success-icon' : 'error-icon blink-fast'"
  >
    <div class="interactive-zone" :class="{ 'is-offline-mode': isOffline }">
      <div class="ambient-glow" />

      <div class="mock-ui">
        <div class="mock-header">
          <div class="mock-title" />
          <div class="mock-toggle" :class="{ active: isOffline }" @click="toggleOffline">
            <div class="toggle-knob" />
            <Icon icon="mdi:airplane" class="airplane-icon" />
          </div>
        </div>
        <div class="mock-body">
          <div v-for="i in 3" :key="i" class="mock-line" />
        </div>
      </div>

      <p v-if="isOffline" class="success-text">
        {{ t('onboarding.step6_success') }}
      </p>
    </div>

    <!-- Фиксированная зона действий -->
    <div class="step-actions">
      <Transition name="fade" mode="out-in">
        <KitBtn v-if="isOffline" color="primary" class="next-btn" @click="emit('next')">
          {{ t('onboarding.next') }} <Icon icon="mdi:arrow-right" />
        </KitBtn>
        <div v-else class="hint-action blink" @click="toggleOffline">
          <Icon icon="mdi:toggle-switch-outline" />
          <span>{{ t('onboarding.step6_action') }}</span>
        </div>
      </Transition>
    </div>
  </OnboardingStepLayout>
</template>

<style lang="scss" scoped>
:deep(.error-icon) {
  color: var(--fg-error-color, #ef4444) !important;
}
:deep(.success-icon) {
  color: var(--fg-success-color, #22c55e) !important;
}
.blink-fast {
  animation: blink-anim 1s infinite;
}

.interactive-zone {
  width: 100%;
  padding: 32px;
  margin-bottom: 32px;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  transition: all 0.5s;

  &.is-offline-mode {
    .ambient-glow {
      opacity: 1;
    }
    .mock-line {
      background: var(--fg-primary-color);
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
    }
    .mock-title {
      background: var(--fg-primary-color);
    }
  }
}

/* Зона для кнопок внизу */
.step-actions {
  height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ambient-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(253, 224, 71, 0.15) 0%, transparent 70%);
  opacity: 0;
  transition: opacity 1s;
  pointer-events: none;
}

.mock-ui {
  width: 100%;
  max-width: 320px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  position: relative;
  z-index: 2;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.mock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.mock-title {
  width: 120px;
  height: 16px;
  background: var(--border-secondary-color);
  border-radius: 8px;
  transition: all 0.5s;
}

.mock-toggle {
  width: 52px;
  height: 28px;
  background: var(--border-secondary-color);
  border-radius: 14px;
  position: relative;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;

  .toggle-knob {
    width: 24px;
    height: 24px;
    background: #fff;
    border-radius: 50%;
    position: absolute;
    left: 2px;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .airplane-icon {
    position: absolute;
    right: 6px;
    font-size: 14px;
    color: var(--fg-tertiary-color);
    opacity: 0;
    transition: opacity 0.3s;
  }

  &.active {
    background: var(--fg-success-color);

    .toggle-knob {
      transform: translateX(24px);
    }

    .airplane-icon {
      opacity: 1;
      left: 6px;
      right: auto;
      color: #fff;
    }
  }
}

.mock-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mock-line {
  height: 12px;
  background: var(--border-secondary-color);
  border-radius: 6px;
  transition: all 0.5s;

  &:nth-child(1) {
    width: 100%;
  }
  &:nth-child(2) {
    width: 85%;
  }
  &:nth-child(3) {
    width: 60%;
  }
}

.success-text {
  color: var(--fg-primary-color);
  font-weight: 500;
  margin: 0;
  text-align: center;
  max-width: 320px;
  position: relative;
  z-index: 2;
  animation: fade-in 0.5s;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

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

  svg {
    font-size: 1.4rem;
  }
}

.next-btn {
  font-size: 1.1rem;
  padding: 12px 32px;
  border-radius: 99px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
