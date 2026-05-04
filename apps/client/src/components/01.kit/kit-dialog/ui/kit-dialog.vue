<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, useId, watch } from 'vue'

interface Props {
  maxWidth?: number
  title?: string
  icon?: string
  persistent?: boolean
  description?: string
}

const {
  maxWidth = 700,
  title,
  icon,
  persistent = false,
  description,
} = defineProps<Props>()

const visible = defineModel<boolean>('visible', { required: true })

const maxWidthPx = computed(() => `${maxWidth}px`)
const dialogId = useId()

function handleOverlayClick(event: MouseEvent) {
  if (persistent)
    return

  const target = event.target as HTMLElement

  if (event.offsetX > target.clientWidth || event.offsetY > target.clientHeight) {
    return
  }

  visible.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value && !persistent) {
    visible.value = false
  }
}

watch(visible, (isOpen) => {
  if (typeof window === 'undefined')
    return
  if (isOpen) {
    document.body.style.setProperty('overflow', 'hidden')
  }
  else {
    document.body.style.removeProperty('overflow')
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (typeof window !== 'undefined') {
    document.body.style.removeProperty('overflow')
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog" :duration="300" appear>
      <div v-if="visible" class="dialog-root">
        <div class="dialog-overlay" @mousedown="handleOverlayClick" />

        <div
          class="dialog-content-wrapper"
          :style="{ maxWidth: maxWidthPx }"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? `dialog-title-${dialogId}` : undefined"
          :aria-describedby="description ? `dialog-desc-${dialogId}` : undefined"
          @mousedown.stop
        >
          <!-- Остальной код шаблона остается без изменений -->
          <div class="dialog-header">
            <slot v-if="$slots.header" name="header" />
            <template v-else>
              <div class="title-container">
                <Icon v-if="icon" :icon="icon" class="title-icon" />
                <h2 :id="`dialog-title-${dialogId}`" class="dialog-title">
                  {{ title }}
                </h2>
              </div>
            </template>

            <button
              class="close-button"
              :aria-label="`Закрыть диалог ${title ?? ''}`"
              @click="visible = false"
            >
              <Icon icon="mdi:close" />
            </button>
          </div>

          <p
            :id="`dialog-desc-${dialogId}`"
            :class="description ? 'dialog-description' : 'sr-only'"
          >
            {{ description ?? title }}
          </p>

          <div class="dialog-body">
            <slot />
          </div>

          <div v-if="$slots.footer" class="dialog-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.dialog-root {
  position: relative;
  z-index: 1000;
}

.dialog-overlay {
  background-color: rgba(0, 0, 0, 0.4);
  position: fixed;
  inset: 0;
  top: env(safe-area-inset-top);

  .dialog-enter-active & {
    animation: overlay-show 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .dialog-leave-active & {
    animation: overlay-hide 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }
}

.dialog-content-wrapper {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  z-index: 1001;
  width: 90vw;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 90vh;

  &:focus {
    outline: none;
  }

  .dialog-enter-active & {
    animation: content-warp-in 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  .dialog-leave-active & {
    animation: content-warp-out 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
  }

  @include media-down(sm) {
    padding: 12px;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    transform: none;
    width: 100%;
    max-width: 100% !important;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    max-height: 92dvh;

    .dialog-enter-active & {
      animation: content-slide-up 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .dialog-leave-active & {
      animation: content-slide-down 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
    }
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--fg-primary-color);
}

.title-icon {
  font-size: 1.25rem;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.dialog-description {
  font-size: 0.875rem;
  color: var(--fg-secondary-color);
  margin-top: -8px;
  margin-bottom: 0;
}

.close-button {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--fg-secondary-color);
  border-radius: var(--r-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }
}

.dialog-body {
  flex-grow: 1;
  overflow-y: auto;
}

.dialog-footer {
  flex-shrink: 0;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--border-secondary-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@keyframes overlay-show {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes overlay-hide {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes content-warp-in {
  from {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.9) rotateX(10deg) skewX(3deg);
    filter: blur(6px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotateX(0) skewX(0);
    filter: blur(0);
  }
}
@keyframes content-warp-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotateX(0) skewX(0);
    filter: blur(0);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -48%) scale(0.85) rotateX(10deg) skewX(4deg);
    filter: blur(8px);
  }
}

@keyframes content-slide-up {
  from {
    opacity: 0;
    transform: translateY(100%);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes content-slide-down {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}
</style>
