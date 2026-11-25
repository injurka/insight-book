<script lang="ts" setup>
import type { ToastMessage } from '~/01.shared/types/models/toast'
import { Icon } from '@iconify/vue'
import { useSwipe } from '@vueuse/core'

interface Props {
  message: ToastMessage
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'remove'): void
}>()

const toastEl = useTemplateRef<HTMLElement>('toastEl')

const { isSwiping, direction, lengthX } = useSwipe(toastEl, {
  threshold: 60,
  onSwipeEnd: () => {
    if (props.message.swipeToClose && (direction.value === 'left' || direction.value === 'right')) {
      if (Math.abs(lengthX.value) > 60)
        emit('remove')
    }
  },
})

const TOAST_ICONS: Record<ToastMessage['type'], string> = {
  success: 'mdi:check-circle-outline',
  error: 'mdi:alert-octagon-outline',
  warn: 'mdi:alert-circle-outline',
  info: 'mdi:information-outline',
}

const icon = computed(() => TOAST_ICONS[props.message.type] ?? TOAST_ICONS.info)

const itemClass = computed(() => `kit-toast-item kit-toast-item--${props.message.type}`)
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
    <span class="kit-toast-item-icon" aria-hidden="true">
      <Icon :icon="icon" class="toast-icon-svg" />
    </span>
    <div class="kit-toast-item-detail">
      <div class="detail-text">
        {{ message.detail }}
      </div>
      <button
        v-if="message.action"
        type="button"
        class="action-btn"
        @click.stop="handleAction"
      >
        {{ message.action.label }}
      </button>
    </div>
    <button
      type="button"
      class="kit-toast-item-close"
      aria-label="Close"
      @click.stop="emit('remove')"
    >
      <Icon icon="mdi:close" />
    </button>
  </div>
</template>

<style lang="scss">
.kit-toast-item {
  --toast-accent: var(--fg-accent-color);

  position: relative;
  width: fit-content;
  min-width: 240px;
  max-width: 350px;
  padding: 10px 10px 10px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: all;
  cursor: grab;
  user-select: none;
  touch-action: none;
  font-family: inherit;
  color: var(--fg-primary-color);
  background: color-mix(in srgb, var(--bg-primary-color) 92%, var(--bg-secondary-color));
  backdrop-filter: blur(12px);
  border: 1px solid color-mix(in srgb, var(--toast-accent) 24%, var(--border-primary-color));
  border-radius: 12px;
  box-shadow:
    0 10px 26px -8px rgba(0, 0, 0, 0.16),
    0 2px 6px -1px rgba(0, 0, 0, 0.06);
  transform-origin: right center;

  @include media-down(sm) {
    width: 100%;
    min-width: 0;
    max-width: none;
  }

  &:active {
    cursor: grabbing;
  }

  &-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--toast-accent) 13%, transparent);
    color: var(--toast-accent);

    .toast-icon-svg {
      width: 18px;
      height: 18px;
    }
  }

  &-detail {
    flex: 1 1 auto;
    min-width: 0;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .detail-text {
      font-size: 0.88rem;
      font-weight: 500;
      line-height: 1.4;
      word-break: break-word;
    }
  }

  &-close {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--fg-tertiary-color);
    opacity: 0.7;
    cursor: pointer;
    transition:
      opacity 0.15s ease,
      color 0.15s ease,
      background-color 0.15s ease;

    &:hover {
      opacity: 1;
      color: var(--fg-primary-color);
      background: color-mix(in srgb, var(--fg-primary-color) 8%, transparent);
    }

    svg {
      width: 15px;
      height: 15px;
    }
  }

  .action-btn {
    align-self: flex-start;
    padding: 3px 10px;
    border: 1px solid color-mix(in srgb, var(--toast-accent) 35%, transparent);
    border-radius: 6px;
    background: color-mix(in srgb, var(--toast-accent) 10%, transparent);
    color: var(--toast-accent);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover {
      background: color-mix(in srgb, var(--toast-accent) 18%, transparent);
    }
  }

  &--error {
    --toast-accent: var(--fg-error-color);
  }
  &--success {
    --toast-accent: var(--fg-success-color);
  }
  &--warn {
    --toast-accent: var(--fg-warning-color);
  }
  &--info {
    --toast-accent: var(--fg-accent-color);
  }
}
</style>
