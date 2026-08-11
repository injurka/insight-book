<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { loadLanguageAsync } from '~/00.plugins/i18n'
import { ThemesVariant, useChangeTheme } from '~/01.shared/composables/use-change-theme'
import { useTracking } from '~/01.shared/composables/use-tracking'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg/index.ts'
import KitDropdown from '~/02.kit/molecules/kit-dropdown/ui/kit-dropdown.vue'

import OnboardingBackground from './onboarding-background.vue'

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
const { t } = useI18n()
const { trackEvent } = useTracking()
const settingsStore = useGlobalSettingsStore()
const { theme, toggleTheme } = useChangeTheme()

const currentThemeIcon = computed(() => {
  switch (theme.value) {
    case ThemesVariant.System: return 'mdi:theme-light-dark'
    case ThemesVariant.Light: return 'mdi:weather-sunny'
    case ThemesVariant.Dark: return 'mdi:weather-night'
    case ThemesVariant.Sepia: return 'mdi:book-open-page-variant'
    case ThemesVariant.Green: return 'mdi:leaf'
    case ThemesVariant.Oled: return 'mdi:moon-waning-crescent'
    default: return 'mdi:theme-light-dark'
  }
})

const appLangOptions = [
  { label: 'Русский', value: 'ru' },
  { label: 'English', value: 'en' },
  { label: '中文', value: 'zh' },
]

async function setLanguage(lang: string) {
  await loadLanguageAsync(lang)
  settingsStore.appLanguage = lang
  trackEvent('app_language_changed', { language: lang })
}

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

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

function finishOnboarding() {
  localStorage.setItem('insight_onboarding_completed', 'true')
  router.push(AppRoutePaths.Home)
}
</script>

<template>
  <div class="onboarding-page">
    <!-- Делаем WebGL фон менее навязчивым -->
    <div class="bg-wrapper">
      <OnboardingBackground />
    </div>
    <KitHoverRevealBg :opacity="0.08" />

    <!-- Плавающие элементы управления сверху -->
    <header class="top-header">
      <div class="settings-group">
        <KitDropdown width="140px" placement="bottom-start" :z-index="10001">
          <template #activator>
            <button class="icon-btn" :aria-label="t('globalActions.switchLanguage')">
              <Icon icon="mdi:translate" />
            </button>
          </template>
          <div class="lang-dropdown-list">
            <button
              v-for="lang in appLangOptions"
              :key="lang.value"
              class="lang-dropdown-item"
              :class="{ 'is-active': settingsStore.appLanguage === lang.value }"
              @click="setLanguage(lang.value)"
            >
              <span>{{ lang.label }}</span>
              <Icon v-if="settingsStore.appLanguage === lang.value" icon="mdi:check" class="check-icon" />
            </button>
          </div>
        </KitDropdown>

        <button class="icon-btn" :aria-label="t('globalActions.switchTheme')" @click="toggleTheme">
          <Icon :icon="currentThemeIcon" />
        </button>
      </div>

      <button class="skip-btn" title="Пропустить" @click="finishOnboarding">
        <span>Пропустить</span>
        <Icon icon="mdi:arrow-right" />
      </button>
    </header>

    <!-- Основной контент без "коробки" - полноэкранный фокус -->
    <main class="onboarding-content-area">
      <Transition name="premium-slide" mode="out-in">
        <component
          :is="CurrentComponent"
          :key="currentStep"
          @next="nextStep"
          @finish="finishOnboarding"
        />
      </Transition>
    </main>

    <!-- Современный элегантный индикатор прогресса -->
    <footer class="bottom-nav">
      <button
        class="nav-icon-btn"
        :class="{ 'is-hidden': currentStep === 0 }"
        @click="prevStep"
      >
        <Icon icon="mdi:arrow-left" />
      </button>

      <div class="progress-pill">
        <div
          v-for="(_, index) in steps"
          :key="index"
          class="progress-segment"
          :class="{ 'is-active': currentStep === index, 'is-passed': index < currentStep }"
          @click="currentStep = index"
        />
      </div>

      <button
        class="nav-icon-btn"
        :class="{ 'is-hidden': currentStep === steps.length - 1 }"
        @click="nextStep"
      >
        <Icon icon="mdi:arrow-right" />
      </button>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
.onboarding-page {
  font-family: var(--app-font-family);
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary-color);
  overflow: hidden;
  z-index: 10000;
  color: var(--fg-primary-color);
}

.bg-wrapper {
  position: absolute;
  inset: 0;
  opacity: 0.25;
  pointer-events: none;
  z-index: 0;
  transition: opacity 1s ease;
}

.top-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: max(24px, env(safe-area-inset-top, 24px)) max(32px, env(safe-area-inset-right, 32px)) 0
    max(32px, env(safe-area-inset-left, 32px));

  @include media-down(sm) {
    padding: max(16px, env(safe-area-inset-top, 16px)) max(16px, env(safe-area-inset-right, 16px)) 0
      max(16px, env(safe-area-inset-left, 16px));
  }
}

.settings-group {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--bg-secondary-color-rgb), 0.5);
  backdrop-filter: blur(12px);
  padding: 3px;
  border-radius: 100px;
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.2);
  height: 48px;
  box-sizing: border-box;

  @include media-down(sm) {
    height: 40px;
    padding: 2px;
    gap: 4px;
  }
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);

  @include media-down(sm) {
    width: 34px;
    height: 34px;
    font-size: 1.1rem;
  }

  &:hover {
    background: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
    transform: translateY(-2px);
  }
}

.skip-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 20px;
  border-radius: 100px;
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.2);
  background: rgba(var(--bg-secondary-color-rgb), 0.5);
  backdrop-filter: blur(12px);
  color: var(--fg-secondary-color);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.3s ease;

  @include media-down(sm) {
    height: 40px;
    padding: 0 16px;
    font-size: 0.85rem;
    gap: 6px;
  }

  &:hover {
    background: rgba(var(--bg-secondary-color-rgb), 0.4);
    border-color: rgba(var(--border-primary-color-rgb), 0.3);
    color: var(--fg-primary-color);
  }
}

.onboarding-content-area {
  position: relative;
  z-index: 5;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 48px;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;

  @include media-down(md) {
    padding: 24px;
  }
}

.bottom-nav {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding-bottom: max(48px, env(safe-area-inset-bottom, 48px));

  @include media-down(sm) {
    gap: 12px;
    padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
    padding-left: 16px;
    padding-right: 16px;
    width: 100%;
    box-sizing: border-box;
  }
}

.nav-icon-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: rgba(var(--bg-secondary-color-rgb), 0.5);
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  @include media-down(sm) {
    width: 40px;
    height: 40px;
    font-size: 1.2rem;
  }

  &:hover {
    background: var(--fg-primary-color);
    color: var(--bg-primary-color);
    transform: scale(1.08);
  }

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
    transform: scale(0.8);
  }
}

.progress-pill {
  display: flex;
  gap: 6px;
  background: rgba(var(--bg-secondary-color-rgb), 0.2);
  backdrop-filter: blur(10px);
  padding: 8px 12px;
  border-radius: 100px;

  @include media-down(sm) {
    gap: 4px;
    padding: 6px 10px;
  }
}

.progress-segment {
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-secondary-color);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;

  @include media-down(sm) {
    width: 12px;
    height: 4px;
  }

  @include media-down(xs) {
    width: 8px;
  }

  &.is-passed {
    background: var(--fg-secondary-color);
  }

  &.is-active {
    width: 36px;
    background: var(--fg-accent-color);

    @include media-down(sm) {
      width: 20px;
    }

    @include media-down(xs) {
      width: 14px;
    }
  }

  &:hover:not(.is-active) {
    background: var(--fg-primary-color);
  }
}

/* Premium Transitions */
.premium-slide-enter-active,
.premium-slide-leave-active {
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.premium-slide-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
.premium-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(1.02);
}

// Переопределение стилей выпадающего списка
.lang-dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: var(--bg-primary-color);
  border-radius: 16px;
  border: 1px solid var(--border-primary-color);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}

.lang-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-secondary-color);
    color: var(--fg-primary-color);
  }

  &.is-active {
    color: var(--fg-accent-color);
    background: var(--bg-accent-overlay-color);
    font-weight: 600;
  }
}
</style>
