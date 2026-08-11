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
const isAudioPlayed = ref(false)
const isRecording = ref(false)
const isSuccess = ref(false)

function playAudio() {
  if (isAudioPlayed.value || isSuccess.value)
    return
  isAudioPlayed.value = true

  setTimeout(() => {
    isAudioPlayed.value = false
    isRecording.value = true

    setTimeout(() => {
      isRecording.value = false
      isSuccess.value = true
    }, 2000)
  }, 1500)
}
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step3_title')"
    :description="t('onboarding.step3_desc')"
    icon="mdi:headphones"
    icon-class="success-icon"
  >
    <div class="interactive-zone centered">
      <div class="mock-word" :class="{ 'gradient-text': isSuccess }">
        {{ t('onboarding.step3_word') }}
      </div>

      <div class="actions-wrapper">
        <KitBtn
          v-if="!isSuccess && !isRecording"
          icon="mdi:volume-high"
          variant="tonal"
          color="primary"
          size="lg"
          class="play-btn"
          :class="{ playing: isAudioPlayed }"
          @click="playAudio"
        >
          {{ t('onboarding.step3_action') }}
        </KitBtn>

        <div v-if="isRecording" class="recording-state pulse">
          <Icon icon="mdi:microphone" class="mic-icon" />
          <div class="sound-waves">
            <span class="wave w1" />
            <span class="wave w2" />
            <span class="wave w3" />
            <span class="wave w2" />
            <span class="wave w1" />
          </div>
        </div>

        <Transition name="bounce">
          <div v-if="isSuccess" class="success-badge">
            <Icon icon="mdi:check-decagram" class="star-icon" />
            <span>100% Accuracy!</span>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Фиксированная зона действий -->
    <div class="step-actions">
      <Transition name="fade" mode="out-in">
        <KitBtn
          v-if="isSuccess"
          color="primary"
          class="next-btn"
          @click="emit('next')"
        >
          {{ t('onboarding.next') }} <Icon icon="mdi:arrow-right" />
        </KitBtn>
      </Transition>
    </div>
  </OnboardingStepLayout>
</template>

<style lang="scss" scoped>
:deep(.success-icon) {
  color: var(--fg-success-color) !important;
}

.interactive-zone {
  width: 100%;
  padding: 32px;
  margin-bottom: 32px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
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

.mock-word {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--fg-primary-color);
  margin-bottom: 24px;
  transition: all 0.5s;

  &.gradient-text {
    background: linear-gradient(135deg, var(--fg-success-color), var(--fg-accent-color));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    transform: scale(1.1);
  }
}

.actions-wrapper {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn.playing {
  animation: jiggle 0.5s ease-in-out;
}

.recording-state {
  display: flex;
  align-items: center;
  gap: 16px;
  color: var(--fg-error-color, #ef4444);

  .mic-icon {
    font-size: 2rem;
  }
}

.sound-waves {
  display: flex;
  gap: 4px;
  height: 24px;
  align-items: center;

  .wave {
    width: 4px;
    background: var(--fg-error-color, #ef4444);
    border-radius: 2px;
    animation: wave-bounce 1s infinite ease-in-out;

    &.w1 {
      height: 10px;
      animation-delay: 0s;
    }
    &.w2 {
      height: 20px;
      animation-delay: 0.2s;
    }
    &.w3 {
      height: 24px;
      animation-delay: 0.4s;
    }
  }
}

.success-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--fg-success-color-rgb, 34, 197, 94), 0.15);
  color: var(--fg-success-color);
  padding: 8px 16px;
  border-radius: 99px;
  font-weight: bold;
  font-size: 1.1rem;
  border: 1px solid rgba(var(--fg-success-color-rgb, 34, 197, 94), 0.3);

  .star-icon {
    font-size: 1.5rem;
  }
}

.next-btn {
  font-size: 1.1rem;
  padding: 12px 32px;
  border-radius: 99px;
}

@keyframes wave-bounce {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(2.5);
  }
}

@keyframes jiggle {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  50% {
    transform: rotate(10deg);
  }
  75% {
    transform: rotate(-10deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

.bounce-enter-active {
  animation: bounce-in 0.5s;
}
@keyframes bounce-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
