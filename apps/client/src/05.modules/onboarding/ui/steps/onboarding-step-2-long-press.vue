<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitTooltip } from '~/02.kit/molecules/kit-tooltip/ui'
import OnboardingStepLayout from './onboarding-step-layout.vue'

const emit = defineEmits<{
  next: []
}>()
const { t } = useI18n()
const isPressing = ref(false)
const isTranslated = ref(false)
const ringX = ref(0)
const ringY = ref(0)
let pressTimer: number | undefined

function startPress(e: MouseEvent | TouchEvent) {
  if (isTranslated.value)
    return
  isPressing.value = true

  let clientX, clientY
  if ('touches' in e) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  }
  else {
    clientX = e.clientX
    clientY = e.clientY
  }

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  ringX.value = clientX - rect.left
  ringY.value = clientY - rect.top

  // Ускоренное долгое нажатие (200мс)
  pressTimer = window.setTimeout(() => {
    isTranslated.value = true
    isPressing.value = false
    if ('vibrate' in navigator)
      navigator.vibrate(50)
  }, 200)
}

function cancelPress() {
  if (!isTranslated.value) {
    isPressing.value = false
    window.clearTimeout(pressTimer)
  }
}
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step2_title')"
    :description="t('onboarding.step2_desc')"
    icon="mdi:gesture-tap-hold"
    icon-class="accent-icon"
  >
    <div class="interactive-zone">
      <Transition name="fade-zoom" mode="out-in">
        <!-- Текст для нажатия -->
        <div
          v-if="!isTranslated"
          class="mock-paragraph-container"
        >
          <div
            class="mock-paragraph"
            @mousedown="startPress"
            @mouseup="cancelPress"
            @mouseleave="cancelPress"
            @touchstart.prevent="startPress"
            @touchend.prevent="cancelPress"
            @touchcancel.prevent="cancelPress"
          >
            {{ t('onboarding.step2_text') }}

            <div
              v-if="isPressing"
              class="progress-ring-container"
              :style="{ left: `${ringX}px`, top: `${ringY}px` }"
            >
              <!-- Приятная анимация круга (ripple) -->
              <div class="ripple-circle" />
            </div>
          </div>
        </div>

        <!-- Внешний вид окна SentenceAnalysis в KitDialog -->
        <div v-else class="mock-dialog-wrapper">
          <div class="dialog-header">
            <div class="title-container">
              <Icon icon="mdi:text-search" class="title-icon" />
              <h2 class="dialog-title">
                Разбор предложения
              </h2>
            </div>
            <div class="header-actions">
              <KitTooltip text="Закрыть" placement="bottom">
                <button class="dialog-icon-btn close-button" @click="isTranslated = false">
                  <Icon icon="mdi:close" />
                </button>
              </KitTooltip>
            </div>
          </div>

          <div class="dialog-body">
            <div class="analysis-content">
              <div class="sentence-header">
                <div class="sentence-content">
                  <div class="original-sentence">
                    {{ t('onboarding.step2_text') }}
                  </div>
                  <div class="sentence-transcription">
                    [Сино эн керер сьемпре ло ке се асе]
                  </div>
                </div>
              </div>

              <div class="analysis-block">
                <h3><Icon icon="mdi:translate" class="inline-icon" /> Перевод</h3>
                <p class="translation-text">
                  {{ t('onboarding.step2_translation') }}
                </p>
              </div>

              <div class="analysis-block">
                <h3><Icon icon="mdi:puzzle-outline" class="inline-icon" /> Грамматика</h3>
                <div class="grammar-card">
                  <div class="rule-pattern">
                    Sino
                  </div>
                  <div class="rule-exp">
                    Противительный союз "а", "но" (используется после отрицания).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Фиксированная зона действий -->
    <div class="step-actions">
      <KitBtn
        v-if="isTranslated"
        color="primary"
        class="next-btn"
        @click="emit('next')"
      >
        {{ t('onboarding.next') }} <Icon icon="mdi:arrow-right" />
      </KitBtn>
      <div v-else class="hint-action blink">
        <Icon icon="mdi:cursor-pointer" />
        <span>{{ t('onboarding.step2_action') }}</span>
      </div>
    </div>
  </OnboardingStepLayout>
</template>

<style lang="scss" scoped>
:deep(.accent-icon) {
  color: var(--fg-accent-color) !important;
}

.interactive-zone {
  width: 100%;
  padding: 16px;
  margin-bottom: 16px;
  min-height: 250px;
  max-height: 450px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: relative;

  @include media-down(sm) {
    min-height: 200px;
    max-height: 380px;
  }
}

.mock-paragraph-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Зона для кнопок внизу */
.step-actions {
  height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mock-dialog-wrapper {
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  width: 100%;
  max-width: 650px;
  max-height: 100%;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  text-align: left;
  overflow: hidden;

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);

    .title-container {
      display: flex;
      align-items: center;
      gap: 10px;

      .title-icon {
        font-size: 1.05rem; /* Было 1.25rem */
        color: var(--fg-primary-color);
      }
      .dialog-title {
        font-size: 0.85rem; /* Было 1rem */
        font-weight: 600;
        margin: 0;
        color: var(--fg-primary-color);
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .dialog-icon-btn {
      background: transparent;
      border: none;
      color: var(--fg-secondary-color);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px; /* Было 32px */
      height: 28px;
      font-size: 1.05rem; /* Было 1.25rem */
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-accent-color);
      }
    }
  }

  .dialog-body {
    padding: 16px;
    overflow-y: auto;
    flex: 1;

    .analysis-content {
      .sentence-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 24px;

        .sentence-content {
          flex-grow: 1;
          padding: 12px 14px;
          background-color: var(--bg-tertiary-color);
          border-left: 4px solid var(--fg-accent-color);
          border-radius: 4px 8px 8px 4px;
          display: flex;
          flex-direction: column;
          gap: 6px;

          .original-sentence {
            font-size: 1.1rem; /* Было 1.3rem */
            font-weight: 500;
            margin: 0;
            color: var(--fg-primary-color);
          }
          .sentence-transcription {
            font-size: 0.9rem; /* Было 1.05rem */
            color: var(--fg-secondary-color);
            line-height: 1.4;
          }
        }
      }

      .analysis-block {
        margin-bottom: 16px;

        h3 {
          font-size: 0.95rem; /* Было 1.1rem */
          margin-bottom: 10px;
          color: var(--fg-accent-color);
          display: flex;
          align-items: center;
          gap: 8px;
          .inline-icon {
            font-size: 1.1rem; /* Было 1.3rem */
          }
        }

        .translation-text {
          font-size: 0.9rem; /* Было 1.05rem */
          line-height: 1.5;
          margin: 0;
          color: var(--fg-primary-color);
        }

        .grammar-card {
          background-color: var(--bg-secondary-color);
          border: 1px solid var(--border-secondary-color);
          padding: 12px;
          border-radius: 8px;

          .rule-pattern {
            font-weight: bold;
            font-size: 0.9rem;
            color: var(--fg-primary-color);
            margin-bottom: 4px;
          }
          .rule-exp {
            font-size: 0.8rem; /* Было 0.95rem */
            color: var(--fg-secondary-color);
          }
        }
      }
    }
  }
}

.mock-paragraph {
  font-size: 1.5rem;
  font-family: var(--app-font-family);
  color: var(--fg-primary-color);
  cursor: pointer;
  padding: 16px;
  border-radius: 8px;
  position: relative;
  transition: all 0.3s;
  user-select: none;
  text-align: center;
}

.progress-ring-container {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ripple-circle {
  width: 100%;
  height: 100%;
  background-color: rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0.3);
  border-radius: 50%;
  transform: scale(0);
  animation: grow-circle 0.35s ease-out forwards;
}

@keyframes grow-circle {
  to {
    transform: scale(1.5);
    opacity: 0.8;
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

  svg {
    font-size: 1.4rem;
  }
}

.next-btn {
  font-size: 1.1rem;
  padding: 12px 32px;
  border-radius: 99px;
}

.fade-zoom-enter-active,
.fade-zoom-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-zoom-enter-from,
.fade-zoom-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.fade-enter-active {
  transition: opacity 0.2s;
}
.fade-leave-active {
  transition: opacity 0.05s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
