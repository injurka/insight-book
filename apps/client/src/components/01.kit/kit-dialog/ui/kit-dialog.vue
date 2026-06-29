<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { useDraggable } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useDialogHistory } from '../composables/use-dialog-history'
import { useDialogResize } from '../composables/use-dialog-resize'
import { useDialogSwipe } from '../composables/use-dialog-swipe'
import DialogResizeHandles from './dialog-resize-handles.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<Props>(), {
  maxWidth: 700,
  persistent: false,
  floating: false,
  resizable: true,
  minimizable: true,
  fullscreen: false,
})

interface Props {
  maxWidth?: number
  title?: string
  icon?: string
  persistent?: boolean
  description?: string
  floating?: boolean
  resizable?: boolean
  minimizable?: boolean
  fullscreen?: boolean
  keyTrigger?: any
  zIndex?: number | string
}

const { t } = useI18n()
const visible = defineModel<boolean>('visible', { required: true })
const dialogId = useId()

const effectiveZIndex = computed(() => Number(props.zIndex ?? 1200))
provide('kit-dialog-z-index', effectiveZIndex)

const dialogContentRef = ref<HTMLElement | null>(null)
const dialogHeaderRef = ref<HTMLElement | null>(null)
const isMinimized = ref(false)

const isFloatingRef = computed(() => props.floating)
const isResizableRef = computed(() => props.resizable)
const isMinimizableRef = computed(() => props.minimizable)

useDialogHistory(dialogId, visible)

const initialX = typeof window !== 'undefined' ? Math.max((window.innerWidth - props.maxWidth) / 2, 0) : 0
const initialY = typeof window !== 'undefined' ? 100 : 0

const { x, y, style: dragStyle } = useDraggable(dialogContentRef, {
  initialValue: { x: initialX, y: initialY },
  handle: dialogHeaderRef,
})

const { isMobile, isSwiping, direction, swipeOffset } = useDialogSwipe({
  headerRef: dialogHeaderRef,
  visible,
  isMinimized,
  isFloating: isFloatingRef,
  isMinimizable: isMinimizableRef,
})

const { dialogWidth, dialogHeight, hasResized, startResize, resetResize } = useDialogResize({
  dialogContentRef,
  x,
  y,
  isFloating: isFloatingRef,
  isResizable: isResizableRef,
})

const maxWidthPx = computed(() => `${props.maxWidth}px`)

function handleOverlayClick(event: MouseEvent) {
  if (props.persistent || props.floating)
    return
  const target = event.target as HTMLElement
  if (event.offsetX > target.clientWidth || event.offsetY > target.clientHeight)
    return
  visible.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value && !props.persistent) {
    visible.value = false
  }
}

watch([visible, isMinimized, () => props.floating], ([isOpen, isMin, isFloating]) => {
  if (typeof window === 'undefined')
    return
  if (isOpen && !isMin && !isFloating) {
    document.body.style.setProperty('overflow', 'hidden')
  }
  else {
    document.body.style.removeProperty('overflow')
  }

  if (isOpen && !hasResized.value) {
    resetResize()
  }
}, { immediate: true })

watch(visible, (isOpen) => {
  if (!isOpen)
    isMinimized.value = false
})

watch(() => props.keyTrigger, () => {
  if (isMinimized.value)
    isMinimized.value = false
})

onMounted(() => document.addEventListener('keydown', handleKeydown))

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  if (typeof window !== 'undefined')
    document.body.style.removeProperty('overflow')
  visible.value = false
  isMinimized.value = false
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog" :duration="300" appear>
      <div v-if="visible" v-show="!isMinimized" class="dialog-root" :style="zIndex ? { '--z-modal': zIndex } : undefined">
        <div v-if="!floating" class="dialog-overlay" @mousedown="handleOverlayClick" />

        <div
          ref="dialogContentRef"
          class="dialog-content-wrapper"
          v-bind="$attrs"
          :class="{
            'is-floating': floating,
            'is-dragging': isSwiping && direction === 'down',
            'is-fullscreen': fullscreen,
          }"
          :style="[
            floating ? dragStyle : {},
            {
              'width': dialogWidth === '100%' ? '100%' : `${dialogWidth}px`,
              'height': dialogHeight === 'auto' ? 'auto' : `${dialogHeight}px`,
              'maxWidth': hasResized ? '100vw' : maxWidthPx,
              'maxHeight': hasResized ? '100vh' : '90vh',
              '--swipe-offset': `${swipeOffset}px`,
            },
          ]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? `dialog-title-${dialogId}` : undefined"
          :aria-describedby="description ? `dialog-desc-${dialogId}` : undefined"
          @mousedown.stop
        >
          <DialogResizeHandles v-if="resizable && !fullscreen" @resize="startResize" />

          <div ref="dialogHeaderRef" class="dialog-header" :class="{ 'is-draggable': floating || (!floating && isMobile) }">
            <div class="mobile-drag-indicator" />
            <slot v-if="$slots.header" name="header" />
            <template v-else>
              <div class="title-container">
                <Icon v-if="icon" :icon="icon" class="title-icon" />
                <h2 :id="`dialog-title-${dialogId}`" class="dialog-title">
                  {{ title }}
                </h2>
              </div>
            </template>

            <div class="header-actions">
              <slot name="header-actions" />
              <button
                v-if="minimizable"
                class="dialog-icon-btn minimize-button"
                :aria-label="t('kit.dialog.minimize')"
                :title="t('kit.dialog.minimize')"
                @click="isMinimized = true"
              >
                <Icon icon="mdi:minus" />
              </button>
              <button
                class="dialog-icon-btn close-button"
                :aria-label="t('kit.dialog.close')"
                :title="t('kit.dialog.close')"
                @click="visible = false"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
          </div>

          <p :id="`dialog-desc-${dialogId}`" :class="description ? 'dialog-description' : 'sr-only'">
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

    <Transition name="fab-zoom" appear>
      <button
        v-if="visible && isMinimized"
        class="dialog-minimized-fab"
        :style="zIndex ? { '--z-modal': zIndex } : undefined"
        :title="title || t('kit.dialog.expand')"
        @click="isMinimized = false"
      >
        <Icon :icon="icon || 'mdi:chevron-up'" />
      </button>
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
  z-index: var(--z-modal, 1200);
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
  z-index: calc(var(--z-modal, 1200) + 1);
  width: 90vw;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-shadow: none;
  &:focus {
    outline: none;
  }
  &:not(.is-floating) {
    .dialog-enter-active & {
      animation: content-warp-in 250ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .dialog-leave-active & {
      animation: content-warp-out 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
    }
  }
  &.is-floating {
    transform: none !important;
    animation: none !important;
    margin: 0;
  }
  &.is-fullscreen {
    width: 100vw !important;
    height: 100dvh !important;
    max-width: 100vw !important;
    max-height: 100dvh !important;
    border-radius: 0 !important;
    border: none !important;
    top: 0 !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    transform: none !important;

    .mobile-drag-indicator {
      display: none !important;
    }
    .dialog-header {
      padding-top: 0 !important;
    }
  }
  @include media-down(sm) {
    padding: 12px;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: 100% !important;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    max-height: 92dvh !important;
    transform: translateY(var(--swipe-offset, 0));
    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
    &.is-dragging {
      transition: none;
    }
    &:not(.is-floating) {
      .dialog-enter-active & {
        animation: content-slide-up 300ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .dialog-leave-active & {
        transition: none !important;
        animation: content-slide-down 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
      }
    }
  }
}
.dialog-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  margin-bottom: 12px;
  &.is-draggable {
    cursor: grab;
    user-select: none;
    &:active {
      cursor: grabbing;
    }
  }
}
.mobile-drag-indicator {
  display: none;
}
@include media-down(sm) {
  .mobile-drag-indicator {
    display: block;
    position: absolute;
    top: 0px;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background-color: var(--border-primary-color);
  }
  .dialog-header {
    padding-top: 14px;
  }
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
.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dialog-icon-btn,
:slotted(.dialog-icon-btn) {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--fg-secondary-color);
  border-radius: var(--r-full);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.2s,
    color 0.2s;
  font-size: 1.25rem;
  width: 32px;
  height: 32px;
  &:hover,
  &.is-active {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }
}
.dialog-body {
  flex-grow: 1;
  overflow-y: auto;
  touch-action: pan-y;
}
.dialog-footer {
  flex-shrink: 0;
  padding-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dialog-minimized-fab {
  position: fixed;
  bottom: calc(env(safe-area-inset-bottom, 20px) + 20px);
  right: 20px;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  color: var(--fg-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.7rem;
  cursor: pointer;
  z-index: calc(var(--z-modal, 1200) - 1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transition:
    border-color 0.2s,
    color 0.2s,
    background-color 0.2s,
    transform 0.2s;
  outline: none;
  &:hover,
  &:active {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
    background-color: var(--bg-hover-color);
    transform: translateY(-2px);
  }
}
.fab-zoom-enter-active,
.fab-zoom-leave-active {
  transition:
    opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.fab-zoom-enter-from,
.fab-zoom-leave-to {
  opacity: 0;
  transform: scale(0.5) translateY(20px);
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
    transform: translateY(var(--swipe-offset, 0));
  }
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}
</style>
