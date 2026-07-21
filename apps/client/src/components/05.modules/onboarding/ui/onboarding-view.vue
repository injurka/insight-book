<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitDropdown } from '~/components/01.kit'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { ThemesVariant, useChangeTheme } from '~/shared/composables/use-change-theme'
import { useUmami } from '~/shared/composables/use-umami'
import { AppRoutePaths } from '~/shared/constants/routes'
import { loadLanguageAsync } from '~/shared/plugins/i18n'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

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
const { trackEvent } = useUmami()
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
    <HoverRevealBg :opacity="0.05" />

    <!-- Кнопка пропуска -->
    <button class="skip-btn" title="Пропустить обучение" @click="finishOnboarding">
      <Icon icon="mdi:close" />
    </button>

    <!-- Настройки: тема и язык -->
    <div class="settings-bar">
      <KitDropdown width="140px" placement="bottom-end" :z-index="10001">
        <template #activator>
          <button class="settings-btn" :aria-label="t('globalActions.switchLanguage')">
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

      <div class="settings-divider" />

      <button class="settings-btn" :aria-label="t('globalActions.switchTheme')" @click="toggleTheme">
        <Icon :icon="currentThemeIcon" />
      </button>
    </div>

    <div class="onboarding-container">
      <Transition name="fade-slide" mode="out-in">
        <component :is="CurrentComponent" :key="currentStep" @next="nextStep" @finish="finishOnboarding" />
      </Transition>

      <div class="progress-indicator">
        <button
          class="nav-btn"
          :class="{ 'is-hidden': currentStep === 0 }"
          aria-label="Назад"
          @click="prevStep"
        >
          <Icon icon="mdi:chevron-left" />
        </button>

        <div class="dots">
          <div
            v-for="(_, index) in steps"
            :key="index"
            class="dot"
            :class="{ active: currentStep === index, passed: index < currentStep }"
            @click="currentStep = index"
          />
        </div>

        <button
          class="nav-btn"
          :class="{ 'is-hidden': currentStep === steps.length - 1 }"
          aria-label="Вперёд"
          @click="nextStep"
        >
          <Icon icon="mdi:chevron-right" />
        </button>
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

  // Резервируем место под settings-bar и skip-btn (≈60px сверху)
  padding-top: max(60px, env(safe-area-inset-top, 60px));
}

.settings-bar {
  position: absolute;
  top: max(16px, env(safe-area-inset-top, 16px));
  left: max(16px, env(safe-area-inset-left, 16px));
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(var(--bg-secondary-color-rgb), 0.7);
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.5);
  border-radius: 14px;
  padding: 5px;
  backdrop-filter: blur(20px) saturate(160%);
  z-index: 1000;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;

  &:hover {
    background: var(--bg-tertiary-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    transform: translateY(-1px);
  }
}

.settings-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 1.15rem;

  &:hover {
    background: var(--bg-accent-overlay-color);
    color: var(--fg-accent-color);
  }

  &:active {
    transform: scale(0.92);
  }
}

.settings-divider {
  width: 1px;
  height: 16px;
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.3);
}

.lang-dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
}

.lang-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  gap: 10px;

  &:hover {
    background: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.is-active {
    color: var(--fg-accent-color);
    background: var(--bg-accent-overlay-color);
    font-weight: 600;
  }

  .check-icon {
    font-size: 0.9rem;
  }
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
  // Ограничиваем высоту оставшимся пространством и включаем скролл
  max-height: calc(100dvh - max(60px, env(safe-area-inset-top, 60px)));
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px;
  padding-bottom: 60px; // место под progress-indicator
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  // Скрываем скроллбар визуально, но оставляем функциональность
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @include media-down(sm) {
    padding: 16px;
    padding-bottom: 60px;
    min-height: unset;
    max-height: calc(100dvh - max(60px, env(safe-area-inset-top, 60px)));
  }
}

.progress-indicator {
  position: absolute;
  bottom: 32px;
  display: flex;
  align-items: center;
  gap: 12px;

  @include media-down(sm) {
    bottom: max(24px, env(safe-area-inset-bottom, 24px));
  }
}

.nav-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(var(--border-primary-color-rgb), 0.4);
  background: rgba(var(--bg-secondary-color-rgb), 0.6);
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  flex-shrink: 0;

  &:hover {
    background: var(--bg-accent-overlay-color);
    color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.92);
  }

  &.is-hidden {
    opacity: 0;
    pointer-events: none;
  }
}

.dots {
  display: flex;
  gap: 8px;
  align-items: center;

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
