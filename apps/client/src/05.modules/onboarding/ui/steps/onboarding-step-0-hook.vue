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
    @click="emit('next')"
  >
    <template #icon>
      <div class="logo-onboarding-container">
        <div class="glow-orb" />
        <div class="glow-orb second" />
        <img src="/logo.png" alt="Insight Logo" class="logo-image">
      </div>
    </template>

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
  color: var(--fg-accent-color);
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

:deep(.step-icon-wrapper) {
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  width: 200px;
  height: 200px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  @include media-down(sm) {
    width: 140px;
    height: 140px;
  }
}

.logo-onboarding-container {
  position: relative;
  width: 180px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;

  @include media-down(sm) {
    width: 120px;
    height: 120px;
  }
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  z-index: 2;
  animation: float-logo 3.5s ease-in-out infinite;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  &:hover {
    transform: scale(1.15) rotate(4deg);
  }
}

.glow-orb {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, var(--fg-accent-color) 0%, transparent 70%);
  opacity: 0.45;
  filter: blur(16px);
  z-index: 1;
  animation: pulse-glow 4s ease-in-out infinite alternate;

  @include media-down(sm) {
    width: 100px;
    height: 100px;
    filter: blur(12px);
  }

  &.second {
    background: radial-gradient(circle, var(--fg-tertiary-color) 0%, transparent 70%);
    animation: pulse-glow 6s ease-in-out infinite alternate-reverse;
    width: 160px;
    height: 160px;

    @include media-down(sm) {
      width: 120px;
      height: 120px;
    }
  }
}

@keyframes float-logo {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes pulse-glow {
  0% {
    transform: translate(-50%, -50%) scale(0.9);
    opacity: 0.3;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.25);
    opacity: 0.55;
  }
}

.blink {
  animation: blink-anim 2s infinite;
}

@keyframes blink-anim {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}
</style>
