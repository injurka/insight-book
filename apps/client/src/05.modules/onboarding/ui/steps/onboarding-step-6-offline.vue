<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
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
    icon="mdi:cloud-sync-outline"
    :icon-class="isOffline ? 'success-icon' : 'accent-icon blink-fast'"
  >
    <div class="interactive-zone" :class="{ 'is-offline-mode': isOffline }">
      <div class="ambient-glow" />

      <div class="mock-ui cache-dialog" :class="{ 'is-caching': isOffline }">
        <div class="mock-header">
          <Icon icon="mdi:cloud-download-outline" class="title-icon" />
          <div class="mock-title-text">
            Кэшировать / Анализ
          </div>
        </div>
        <div class="mock-body">
          <div class="mock-option" @click="toggleOffline">
            <Icon icon="mdi:text-box-outline" class="option-icon" />
            <div class="option-texts">
              <span class="option-title">Кэшировать страницы</span>
            </div>
            <div class="mock-checkbox" :class="{ checked: isOffline }">
              <Icon v-if="isOffline" icon="mdi:check" />
            </div>
          </div>
          <div class="mock-option" @click="toggleOffline">
            <Icon icon="mdi:text-search" class="option-icon" />
            <div class="option-texts">
              <span class="option-title">Анализ предложений</span>
            </div>
            <div class="mock-checkbox" :class="{ checked: isOffline }">
              <Icon v-if="isOffline" icon="mdi:check" />
            </div>
          </div>
          <div class="mock-option" @click="toggleOffline">
            <Icon icon="mdi:volume-high" class="option-icon" />
            <div class="option-texts">
              <span class="option-title">Озвучка</span>
            </div>
            <div class="mock-checkbox" :class="{ checked: isOffline }">
              <Icon v-if="isOffline" icon="mdi:check" />
            </div>
          </div>
        </div>
        <Transition name="fade">
          <div v-if="isOffline" class="mock-progress-container">
            <div class="mock-progress-bar" />
          </div>
        </Transition>
      </div>

      <p v-if="isOffline" class="success-text">
        {{ t('onboarding.step6_success') }}
      </p>
    </div>

    <!-- Фиксированная зона действий -->
    <div class="step-actions">
      <Transition name="fade" mode="out-in">
        <KitBtn
          v-if="isOffline"
          color="primary"
          class="next-btn"
          @click="emit('next')"
        >
          {{ t('onboarding.next') }} <Icon icon="mdi:arrow-right" />
        </KitBtn>
        <div v-else class="hint-action blink" @click="toggleOffline">
          <Icon icon="mdi:cloud-download" />
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
    .mock-option {
      background: var(--bg-hover-color);
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
  background: radial-gradient(circle at center, rgba(34, 197, 94, 0.15) 0%, transparent 70%);
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
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-secondary-color);

  .title-icon {
    font-size: 1.2rem;
    color: var(--fg-secondary-color);
  }

  .mock-title-text {
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.mock-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mock-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-secondary-color);
  transition: all 0.3s;
  cursor: pointer;

  .option-icon {
    font-size: 1.2rem;
    color: var(--fg-tertiary-color);
  }

  .option-texts {
    flex: 1;
    display: flex;
    flex-direction: column;

    .option-title {
      font-size: 0.9rem;
      color: var(--fg-primary-color);
      font-weight: 500;
    }
  }

  .mock-checkbox {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid var(--border-secondary-color);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;
    background: transparent;

    &.checked {
      background: var(--fg-success-color);
      border-color: var(--fg-success-color);
      color: white;
    }

    svg {
      font-size: 14px;
    }
  }
}

.mock-progress-container {
  margin-top: 16px;
  height: 4px;
  background: var(--border-secondary-color);
  border-radius: 2px;
  overflow: hidden;

  .mock-progress-bar {
    height: 100%;
    width: 0%;
    background: var(--fg-success-color);
    animation: progress 1s ease-out forwards;
  }
}

@keyframes progress {
  from {
    width: 0%;
  }
  to {
    width: 100%;
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
  color: var(--fg-accent-color);
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
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}
</style>
