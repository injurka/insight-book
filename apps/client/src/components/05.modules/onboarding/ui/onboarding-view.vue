<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { AppRoutePaths } from '~/shared/constants/routes'

import Step0Hook from './steps/onboarding-step-0-hook.vue'
import Step1Ai from './steps/onboarding-step-1-ai.vue'
import Step2LongPress from './steps/onboarding-step-2-long-press.vue'
import Step3Manga from './steps/onboarding-step-3-manga.vue'
import Step4Srs from './steps/onboarding-step-4-srs.vue'
import Step5Notes from './steps/onboarding-step-5-notes.vue'
import Step6Offline from './steps/onboarding-step-6-offline.vue'
import Step7Stats from './steps/onboarding-step-7-stats.vue'
import Step8Epilogue from './steps/onboarding-step-8-epilogue.vue'

const router = useRouter()

const steps = [
  Step0Hook,
  Step1Ai,
  Step2LongPress,
  Step3Manga,
  Step4Srs,
  Step5Notes,
  Step6Offline,
  Step7Stats,
  Step8Epilogue,
]

const currentStep = ref(0)
const CurrentComponent = computed(() => steps[currentStep.value])

function nextStep() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

function finishOnboarding() {
  localStorage.setItem('insight_onboarding_completed', 'true')
  router.push(AppRoutePaths.Home)
}
</script>

<template>
  <div class="onboarding-page">
    <HoverRevealBg :opacity="0.05" />

    <!-- Кнопка пропуска -->
    <button class="skip-btn" title="Пропустить обучение" @click="finishOnboarding">
      <Icon icon="mdi:close" />
    </button>

    <div class="onboarding-container">
      <Transition name="fade-slide" mode="out-in">
        <component :is="CurrentComponent" :key="currentStep" @next="nextStep" @finish="finishOnboarding" />
      </Transition>

      <div class="progress-indicator">
        <div
          v-for="(_, index) in steps"
          :key="index"
          class="dot"
          :class="{ active: currentStep === index, passed: index < currentStep }"
          @click="currentStep = index"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.onboarding-page {
  font-family: 'Maple Mono CN', 'serif', monospace;
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary-color);
  overflow: hidden;
  z-index: 10000;
}

.skip-btn {
  position: absolute;
  top: max(16px, env(safe-area-inset-top, 16px));
  right: max(16px, env(safe-area-inset-right, 16px));
  z-index: 1000;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(128, 128, 128, 0.1);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.5rem;
  transition: all 0.2s;

  &:hover {
    background: rgba(128, 128, 128, 0.2);
    color: var(--fg-primary-color);
    transform: scale(1.05);
  }
}

.onboarding-container {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 600px;
  min-height: 650px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  @include media-down(sm) {
    padding: 16px;
    min-height: 100dvh;
  }
}

.progress-indicator {
  position: absolute;
  bottom: 32px;
  display: flex;
  gap: 8px;

  @include media-down(sm) {
    bottom: max(24px, env(safe-area-inset-bottom, 24px));
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border-secondary-color);
    transition: all 0.3s;
    cursor: pointer;

    &.passed {
      background: var(--fg-tertiary-color);
    }

    &.active {
      background: var(--fg-accent-color);
      transform: scale(1.3);
    }

    &:hover:not(.active) {
      background: var(--fg-secondary-color);
    }
  }
}

/* Transitions */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
