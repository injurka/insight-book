<script lang="ts" setup>
import type { ToastMessage } from '~/01.shared/types/models/toast'
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
      if (Math.abs(lengthX.value) > 60)
        emit('remove')
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

function handleAction() {
  if (props.message.action) {
    props.message.action.onClick()
    emit('remove')
  }
}
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
      <div class="detail-text">
        {{ message.detail }}
      </div>
      <button v-if="message.action" class="action-btn" @click.stop="handleAction">
        {{ message.action.label }}
      </button>
    </div>
  </div>
</template>

<style lang="scss">
.kit-toast-item {
  width: 100%;
  max-width: 350px;
  min-width: 300px;
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
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.4;
  opacity: 1;
  border: 1px solid transparent;
  transform-origin: right center;

  @include media-down(sm) {
    padding: 16px;
    min-width: 0;
  }

  &:active {
    cursor: grabbing;
  }

  &-detail {
    flex-grow: 1;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .detail-text {
      font-size: 0.9rem;
      word-break: break-word;
      font-family: 'Maple Mono CN', monospace;
    }
  }

  .action-btn {
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.15);
    color: inherit;
    border: 1px solid currentColor;
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
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

    .action-btn {
      background: var(--bg-tertiary-color);
      &:hover {
        background: var(--bg-hover-color);
      }
    }
  }
}
</style>
