<script lang="ts" setup>
import { Icon } from '@iconify/vue'
import { useDraggable, useMediaQuery, useSwipe } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

interface Props {
  maxWidth?: number
  title?: string
  icon?: string
  persistent?: boolean
  description?: string
  floating?: boolean
  resizable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: 700,
  persistent: false,
  floating: false,
  resizable: true,
})

const visible = defineModel<boolean>('visible', { required: true })
const dialogId = useId()

const dialogContentRef = ref<HTMLElement | null>(null)
const dialogHeaderRef = ref<HTMLElement | null>(null)

// Инициализация координат для плавающего окна (по центру)
const initialX = typeof window !== 'undefined' ? Math.max((window.innerWidth - props.maxWidth) / 2, 0) : 0
const initialY = typeof window !== 'undefined' ? 100 : 0

// --- Перетаскивание (Desktop Floating) ---
const { x, y, style: dragStyle } = useDraggable(dialogContentRef, {
  initialValue: { x: initialX, y: initialY },
  handle: dialogHeaderRef,
})

// --- Свайп для закрытия (Mobile Bottom Sheet) ---
const isMobile = useMediaQuery('(max-width: 599px)')

const { lengthY, isSwiping, direction } = useSwipe(dialogHeaderRef, {
  threshold: 10,
  onSwipeEnd: () => {
    // Закрываем, если мы на мобилке, это не плавающее окно, потянули вниз и проскроллили больше 100px
    if (isMobile.value && !props.floating && direction.value === 'down') {
      if (lengthY.value < -100) {
        visible.value = false
      }
    }
  },
})

// Если свайпаем вниз, вычисляем смещение. lengthY при свайпе вниз отрицательный.
const isDraggingDown = computed(() => isMobile.value && !props.floating && isSwiping.value && direction.value === 'down')
const dragOffset = computed(() => isDraggingDown.value ? Math.abs(lengthY.value) : 0)

const maxWidthPx = computed(() => `${props.maxWidth}px`)

// --- Ресайз логика ---
const dialogWidth = ref<number | '100%'>('100%')
const dialogHeight = ref<number | 'auto'>('auto')
const hasResized = ref(false)

let isResizing = false
let currentHandle = ''
let startX = 0
let startY = 0
let startWidth = 0
let startHeight = 0
let startPosX = 0
let startPosY = 0

function startResize(handle: string, e: MouseEvent) {
  if (!props.resizable)
    return

  isResizing = true
  currentHandle = handle
  hasResized.value = true
  startX = e.clientX
  startY = e.clientY

  const rect = dialogContentRef.value!.getBoundingClientRect()
  startWidth = rect.width
  startHeight = rect.height
  startPosX = x.value
  startPosY = y.value

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.userSelect = 'none'
}

function onResize(e: MouseEvent) {
  if (!isResizing || !props.resizable)
    return
  const dx = e.clientX - startX
  const dy = e.clientY - startY

  let newWidth = startWidth
  let newHeight = startHeight
  let newX = startPosX
  let newY = startPosY

  if (props.floating) {
    if (currentHandle.includes('right'))
      newWidth = startWidth + dx
    if (currentHandle.includes('left')) {
      newWidth = startWidth - dx
      newX = startPosX + dx
    }
    if (currentHandle.includes('bottom'))
      newHeight = startHeight + dy
    if (currentHandle.includes('top')) {
      newHeight = startHeight - dy
      newY = startPosY + dy
    }
  }
  else {
    // Если по-центру (закреплено), изменяем размер вдвое, чтобы края двигались вслед за мышью
    if (currentHandle.includes('right'))
      newWidth = startWidth + dx * 2
    if (currentHandle.includes('left'))
      newWidth = startWidth - dx * 2
    if (currentHandle.includes('bottom'))
      newHeight = startHeight + dy * 2
    if (currentHandle.includes('top'))
      newHeight = startHeight - dy * 2
  }

  const MIN_W = 300
  const MIN_H = 200

  if (newWidth < MIN_W) {
    if (props.floating && currentHandle.includes('left')) {
      newX -= (MIN_W - newWidth)
    }
    newWidth = MIN_W
  }
  if (newHeight < MIN_H) {
    if (props.floating && currentHandle.includes('top')) {
      newY -= (MIN_H - newHeight)
    }
    newHeight = MIN_H
  }

  dialogWidth.value = newWidth
  dialogHeight.value = newHeight

  if (props.floating) {
    x.value = newX
    y.value = newY
  }
}

function stopResize() {
  isResizing = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.userSelect = ''
}

function handleOverlayClick(event: MouseEvent) {
  if (props.persistent || props.floating)
    return

  const target = event.target as HTMLElement
  if (event.offsetX > target.clientWidth || event.offsetY > target.clientHeight) {
    return
  }
  visible.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value && !props.persistent) {
    visible.value = false
  }
}

watch([visible, () => props.floating], ([isOpen, isFloating]) => {
  if (typeof window === 'undefined')
    return

  if (isOpen) {
    if (!hasResized.value) {
      dialogWidth.value = '100%'
      dialogHeight.value = 'auto'
    }
    if (!isFloating) {
      document.body.style.setProperty('overflow', 'hidden')
    }
    else {
      document.body.style.removeProperty('overflow')
    }
  }
  else {
    document.body.style.removeProperty('overflow')
  }
}, { immediate: true })

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
        <div v-if="!floating" class="dialog-overlay" @mousedown="handleOverlayClick" />

        <div
          ref="dialogContentRef"
          class="dialog-content-wrapper"
          :class="{
            'is-floating': floating,
            'is-dragging': isDraggingDown,
          }"
          :style="[
            floating ? dragStyle : {},
            {
              'width': dialogWidth === '100%' ? '100%' : `${dialogWidth}px`,
              'height': dialogHeight === 'auto' ? 'auto' : `${dialogHeight}px`,
              'maxWidth': hasResized ? '100vw' : maxWidthPx,
              'maxHeight': hasResized ? '100vh' : '90vh',
              '--swipe-offset': `${dragOffset}px`,
            },
          ]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? `dialog-title-${dialogId}` : undefined"
          :aria-describedby="description ? `dialog-desc-${dialogId}` : undefined"
          @mousedown.stop
        >
          <!-- Элементы ресайза -->
          <template v-if="resizable">
            <div class="resize-handle top" @mousedown.prevent="startResize('top', $event)" />
            <div class="resize-handle right" @mousedown.prevent="startResize('right', $event)" />
            <div class="resize-handle bottom" @mousedown.prevent="startResize('bottom', $event)" />
            <div class="resize-handle left" @mousedown.prevent="startResize('left', $event)" />

            <div class="resize-handle top-left" @mousedown.prevent="startResize('top-left', $event)" />
            <div class="resize-handle top-right" @mousedown.prevent="startResize('top-right', $event)" />
            <div class="resize-handle bottom-left" @mousedown.prevent="startResize('bottom-left', $event)" />
            <div class="resize-handle bottom-right" @mousedown.prevent="startResize('bottom-right', $event)" />
          </template>

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
                class="dialog-icon-btn close-button"
                :aria-label="`Закрыть диалог ${title ?? ''}`"
                @click="visible = false"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
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
  gap: 16px;
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

    /* Управление свайпом */
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
        animation: content-slide-down 200ms cubic-bezier(0.7, 0, 0.84, 0) forwards;
      }
    }
  }
}

.resize-handle {
  position: absolute;
  z-index: 100;

  &.top {
    top: -6px;
    left: 6px;
    right: 6px;
    height: 12px;
    cursor: n-resize;
  }
  &.bottom {
    bottom: -6px;
    left: 6px;
    right: 6px;
    height: 12px;
    cursor: s-resize;
  }
  &.left {
    top: 6px;
    bottom: 6px;
    left: -6px;
    width: 12px;
    cursor: e-resize;
  }
  &.right {
    top: 6px;
    bottom: 6px;
    right: -6px;
    width: 12px;
    cursor: w-resize;
  }

  &.top-left {
    top: -6px;
    left: -6px;
    width: 16px;
    height: 16px;
    cursor: nw-resize;
  }
  &.top-right {
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    cursor: ne-resize;
  }
  &.bottom-left {
    bottom: -6px;
    left: -6px;
    width: 16px;
    height: 16px;
    cursor: sw-resize;
  }
  &.bottom-right {
    bottom: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    cursor: se-resize;
  }
}

/* Строго скрываем на мобильных экранах */
@include media-down(sm) {
  .resize-handle {
    display: none !important;
  }
}

.dialog-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;

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
    padding-top: 14px; // Место для индикатора
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
  // Предотвращаем скролл body за пределами контента во время свайпа
  touch-action: pan-y;
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
    transform: translateY(var(--swipe-offset, 0));
  }
  to {
    opacity: 0;
    transform: translateY(100%);
  }
}
</style>
