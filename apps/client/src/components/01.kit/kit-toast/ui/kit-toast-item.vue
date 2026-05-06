<script lang="ts" setup>
import type { ToastMessage } from '~/shared/types/models/toast'
import { useSwipe } from '@vueuse/core'

interface Props {
  message: ToastMessage
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'remove'): void
}>()

const toastEl = ref<HTMLElement | null>(null)
const itemClass = computed(() => `kit-toast-item kit-toast-item--${props.message.type}`)

const { isSwiping, direction, lengthX } = useSwipe(toastEl, {
  threshold: 60,
  onSwipeEnd: () => {
    if (props.message.swipeToClose && (direction.value === 'left' || direction.value === 'right')) {
      if (Math.abs(lengthX.value) > 60) {
        emit('remove')
      }
    }
  },
})

const swipeStyle = computed(() => {
  if (isSwiping.value) {
    return {
      transform: `translateX(${lengthX.value}px)`,
      opacity: 1 - Math.min(1, Math.abs(lengthX.value) / 200),
      transition: 'none',
    }
  }
  return {}
})
</script>

<template>
  <div
    ref="toastEl"
    :class="itemClass"
    :style="swipeStyle"
    role="alert"
    class="kit-toast-item"
  >
    <div class="kit-toast-item-detail">
      {{ message.detail }}
    </div>
    <button
      class="kit-toast-item-close-btn"
      @click.stop="emit('remove')"
    >
      &times;
    </button>
  </div>
</template>

<style lang="scss">
.kit-toast-item {
  margin-left: auto;
  padding: 16px;
  box-shadow: var(--s-m);
  pointer-events: all;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: center;
  cursor: grab;
  user-select: none;
  touch-action: none;
  font-family: 'Rubik', sans-serif;
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.4;
  opacity: 1;
  max-width: 350px;
  min-width: 300px;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  border: 1px solid transparent;
  transform-origin: right center;

  @include media-down(sm) {
    padding: 16px;
  }

  &:active {
    cursor: grabbing;
  }

  &-detail {
    flex-grow: 1;
    text-align: left;
  }

  &-close-btn {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.7;
    font-size: 1.5rem;
    line-height: 1;
    padding: 0 0.5rem;
    cursor: pointer;
    align-self: flex-start;
    margin: -0.5rem -0.5rem -0.5rem 0;

    &:hover {
      opacity: 1;
    }
  }

  &--error {
    background: var(--bg-error-color);
    color: var(--fg-error-color);
    border-color: var(--border-error-color);
  }
  &--success {
    background: var(--bg-success-color);
    color: var(--fg-success-color);
    border-color: var(--border-success-color);
  }
  &--warn {
    background: var(--bg-warning-color);
    color: var(--fg-warning-color);
    border-color: var(--border-warning-color);
  }
  &--info {
    background: var(--bg-secondary-color);
    color: var(--fg-primary-color);
    border-color: var(--border-primary-color);
  }
}
</style>
