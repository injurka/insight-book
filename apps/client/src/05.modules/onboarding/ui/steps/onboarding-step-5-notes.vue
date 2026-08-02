<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/index.ts'
import OnboardingStepLayout from './onboarding-step-layout.vue'

const emit = defineEmits<{
  next: []
}>()
const { t } = useI18n()
const isSelected = ref(false)
const isSaved = ref(false)
const hlClass = ref('hl-yellow')
const showBtnBlink = ref(false)

let timer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (timer)
    clearTimeout(timer)
})

function onSelect() {
  if (isSaved.value)
    return
  isSelected.value = true

  if (timer)
    clearTimeout(timer)
  timer = setTimeout(() => {
    if (!isSaved.value)
      showBtnBlink.value = true
  }, 3000)
}

function onSave() {
  if (!isSelected.value)
    return
  isSelected.value = false
  isSaved.value = true
  showBtnBlink.value = false
  if (timer)
    clearTimeout(timer)
}
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step5_title')"
    :description="t('onboarding.step5_desc')"
    icon="mdi:notebook-outline"
    icon-class="accent-icon"
  >
    <div class="interactive-zone">
      <div class="notebook-container">
        <div
          class="quote-text"
          :class="[{ 'is-selected': isSelected, 'is-saved': isSaved }, hlClass]"
          @mousedown="onSelect"
          @touchstart.prevent="onSelect"
        >
          "{{ t('onboarding.step5_quote') }}"
        </div>

        <Transition name="pop-up">
          <div v-if="isSelected && !isSaved" class="highlight-actions">
            <button class="action-btn color-1" :class="{ 'is-active': hlClass === 'hl-yellow' }" @click.stop="hlClass = 'hl-yellow'" />
            <button class="action-btn color-2" :class="{ 'is-active': hlClass === 'hl-green' }" @click.stop="hlClass = 'hl-green'" />
            <button class="action-btn color-3" :class="{ 'is-active': hlClass === 'hl-pink' }" @click.stop="hlClass = 'hl-pink'" />
            <div class="divider" />
            <button class="action-btn bookmark-btn" :class="{ blink: showBtnBlink }" @click.stop="onSave">
              <Icon icon="mdi:bookmark-plus" />
            </button>
          </div>
        </Transition>
      </div>

      <div class="notebook-sidebar" :class="{ shake: isSaved }">
        <Icon :icon="isSaved ? 'mdi:notebook-check' : 'mdi:notebook-outline'" class="sidebar-icon" :class="{ saved: isSaved }" />
      </div>

      <Transition name="fly-to-sidebar">
        <div v-if="isSaved" class="flying-quote">
          <Icon icon="mdi:format-quote-close" />
        </div>
      </Transition>
    </div>

    <!-- Фиксированная зона действий -->
    <div class="step-actions">
      <KitBtn
        v-if="isSaved"
        color="primary"
        class="next-btn"
        @click="emit('next')"
      >
        {{ t('onboarding.next') }} <Icon icon="mdi:arrow-right" />
      </KitBtn>
      <div v-else-if="!isSelected" class="hint-action blink" @click="onSelect">
        <Icon icon="mdi:bookmark-plus" />
        <span>{{ t('onboarding.step5_action') }}</span>
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
  padding: 32px;
  margin-bottom: 32px;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  position: relative;
}

/* Зона для кнопок внизу */
.step-actions {
  height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notebook-container {
  position: relative;
  max-width: 400px;
  flex: 1;
}

.quote-text {
  font-size: 1.3rem;
  font-family: 'Maple Mono CN', 'Courier New', monospace;
  line-height: 1.6;
  color: var(--fg-primary-color);
  cursor: text;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.3s;
  user-select: none;

  --hl-base: 253, 224, 71;
  &.hl-yellow {
    --hl-base: 253, 224, 71;
  }
  &.hl-green {
    --hl-base: 134, 239, 172;
  }
  &.hl-pink {
    --hl-base: 244, 114, 182;
  }

  &.is-selected {
    background: rgba(var(--hl-base), 0.4);
  }

  &.is-saved {
    background: rgba(var(--hl-base), 0.2);
    border-bottom: 2px dashed rgba(var(--hl-base), 0.8);
  }
}

.highlight-actions {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-tertiary-color);
  padding: 8px 12px;
  border-radius: 99px;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-primary-color);
  z-index: 10;

  .action-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition:
      transform 0.2s,
      border-color 0.2s;

    &:hover {
      transform: scale(1.2);
    }

    &.is-active {
      transform: scale(1.2);
      border-color: var(--fg-primary-color);
    }

    &.color-1 {
      background: #fde047;
    }
    &.color-2 {
      background: #86efac;
    }
    &.color-3 {
      background: #f472b6;
    }

    &.bookmark-btn {
      background: transparent;
      color: var(--fg-primary-color);
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      transition: all 0.2s;

      &:hover {
        transform: scale(1.1);
        color: var(--fg-accent-color);
        background: var(--bg-hover-color);
      }

      &.blink {
        color: var(--fg-accent-color);
        background: var(--bg-focus-color);
        animation: blink-button-anim 2s infinite;
      }
    }
  }

  .divider {
    width: 1px;
    height: 24px;
    background-color: var(--border-primary-color);
    margin: 0 4px;
  }
}

.notebook-sidebar {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;

  .sidebar-icon {
    font-size: 2.5rem;
    color: var(--fg-tertiary-color);
    transition: all 0.3s;

    &.saved {
      color: var(--fg-accent-color);
    }
  }

  &.shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
}

.flying-quote {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;
  color: var(--fg-accent-color);
  pointer-events: none;
  animation: fly 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes fly {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(120px, 0) scale(0);
    opacity: 0;
  }
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
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

.pop-up-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pop-up-enter-from {
  opacity: 0;
  transform: translateX(-50%) scale(0.8) translateY(10px);
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
@keyframes blink-button-anim {
  0%,
  100% {
    opacity: 0.8;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.18);
  }
}
</style>
