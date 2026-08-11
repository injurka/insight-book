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
const isWordSaved = ref(false)
const isDragging = ref(false)
const showNextBtn = ref(false)

function onDragStart(e: DragEvent) {
  isDragging.value = true
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', 'word')
  }
}

function onDragEnd() {
  isDragging.value = false
}

function onDrop() {
  isWordSaved.value = true
  isDragging.value = false
  setTimeout(() => {
    showNextBtn.value = true
  }, 1000)
}

function onTouchStart(_e: TouchEvent) {
  isDragging.value = true
}

function onTouchMove(e: TouchEvent) {
  e.preventDefault() // prevent scroll
}

function onTouchEnd(e: TouchEvent) {
  isDragging.value = false
  const touch = e.changedTouches[0]
  if (touch) {
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
    if (target && target.closest('.chest-dropzone'))
      onDrop()
  }
}
</script>

<template>
  <OnboardingStepLayout
    :title="t('onboarding.step4_title')"
    :description="t('onboarding.step4_desc')"
    icon="mdi:treasure-chest"
    icon-class="warning-icon"
  >
    <div class="interactive-zone dictionary-zone">
      <!-- Зона с фиксированной высотой для карточки, чтобы избежать скачков -->
      <div class="zone-top">
        <Transition name="fade-slide-down" mode="out-in">
          <div
            v-if="!isWordSaved"
            class="mock-word-card"
            :class="{ dragging: isDragging }"
            draggable="true"
            @dragstart="onDragStart"
            @dragend="onDragEnd"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <div style="display: flex; align-items: center; gap: 12px;">
              <Icon icon="mdi:drag" class="drag-handle" />
              <span class="word-text">{{ t('onboarding.step3_word') }}</span>
            </div>
            <KitBtn
              icon="mdi:bookmark-plus-outline"
              color="warning"
              size="sm"
              @click="isWordSaved = true"
            >
              {{ t('onboarding.step4_action') }}
            </KitBtn>
          </div>
          <p v-else class="success-text">
            {{ t('onboarding.step4_success') }}
          </p>
        </Transition>
      </div>

      <div
        class="chest-dropzone"
        :class="{ 'is-active': isDragging, 'is-saved': isWordSaved }"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <Icon
          :icon="isWordSaved ? 'mdi:treasure-chest' : 'mdi:treasure-chest-outline'"
          class="chest-icon"
        />
        <div v-if="isWordSaved" class="srs-phases">
          <span class="phase p1">Новое</span>
          <Icon icon="mdi:arrow-right" class="arr" />
          <span class="phase p2">Изучаю</span>
          <Icon icon="mdi:arrow-right" class="arr" />
          <span class="phase p3">Выучено</span>
        </div>
      </div>
    </div>

    <!-- Фиксированная зона действий -->
    <div class="step-actions">
      <Transition name="fade" mode="out-in">
        <KitBtn
          v-if="showNextBtn"
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
:deep(.warning-icon) {
  color: var(--fg-warning-color) !important;
}

.interactive-zone {
  width: 100%;
  padding: 16px;
  margin-bottom: 32px;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px; /* Немного уменьшили gap из-за врапперов */
}

/* Контейнеры с фиксированной высотой предотвращают прыжки */
.zone-top {
  width: 100%;
  height: 72px;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Зона для кнопок внизу */
.step-actions {
  height: 60px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mock-word-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 360px;
  padding: 16px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  cursor: grab;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);

  &:active {
    cursor: grabbing;
  }
  &.dragging {
    opacity: 0.5;
  }

  .drag-handle {
    color: var(--fg-tertiary-color);
    font-size: 1.5rem;
    cursor: grab;
  }

  .word-text {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
}

.chest-dropzone {
  width: 100%;
  max-width: 360px;
  height: 150px;
  border: 2px dashed var(--border-secondary-color);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  background: var(--bg-secondary-color);
  gap: 12px;
  padding: 16px;

  &.is-active {
    border-color: var(--fg-warning-color);
    background: rgba(var(--fg-warning-color-rgb, 227, 179, 65), 0.1);
  }

  &.is-saved {
    border: 2px solid var(--fg-warning-color);
    background: rgba(var(--fg-warning-color-rgb, 227, 179, 65), 0.15);
  }

  .chest-icon {
    font-size: 3.5rem;
    color: var(--fg-warning-color);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  &.is-saved .chest-icon {
    transform: scale(1.1);
  }
}

.srs-phases {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.9rem;
  font-weight: bold;
  height: 24px;

  .phase {
    opacity: 0;
    animation: fade-in-phase 0.5s forwards;

    &.p1 {
      animation-delay: 0.5s;
      color: var(--fg-error-color, #ef4444);
    }
    &.p2 {
      animation-delay: 1s;
      color: var(--fg-warning-color);
    }
    &.p3 {
      animation-delay: 1.5s;
      color: var(--fg-success-color);
    }
  }

  .arr {
    opacity: 0;
    animation: fade-in-phase 0.5s forwards;
    color: var(--fg-tertiary-color);
    font-size: 1.1rem;
    &:nth-of-type(1) {
      animation-delay: 0.75s;
    }
    &:nth-of-type(2) {
      animation-delay: 1.25s;
    }
  }
}

.success-text {
  color: var(--fg-warning-color);
  font-weight: 500;
  margin: 0;
  text-align: center;
}

.next-btn {
  font-size: 1.1rem;
  padding: 12px 32px;
  border-radius: 99px;
}

@keyframes fade-in-phase {
  to {
    opacity: 1;
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

.fade-slide-down-leave-active {
  transition: all 0.3s ease-in;
}
.fade-slide-down-leave-to {
  opacity: 0;
  transform: translateY(30px) scale(0.85);
}
</style>
