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

const toastEl = ref<HTMLElement | null>(null)

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
  success: 'mdi:bookmark-check-outline',
  error: 'mdi:book-alert-outline',
  warn: 'mdi:bookmark-remove-outline',
  info: 'mdi:book-open-page-variant-outline',
}

const icon = computed(() => TOAST_ICONS[props.message.type] ?? TOAST_ICONS.info)
const progressStyle = computed(() => ({ animationDuration: `${props.message.expire}ms` }))

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
    <span class="kit-toast-item-ribbon" aria-hidden="true">
      <Icon :icon="icon" class="ribbon-icon" />
    </span>
    <div class="kit-toast-item-detail">
      <div class="detail-text">
        {{ message.detail }}
      </div>
      <button v-if="message.action" class="action-btn" @click.stop="handleAction">
        {{ message.action.label }}
      </button>
    </div>
    <span
      v-if="message.expire > 0"
      class="kit-toast-item-progress"
      :style="progressStyle"
      aria-hidden="true"
    />
  </div>
</template>

<style lang="scss">
.kit-toast-item {
  --toast-accent: var(--fg-accent-color);

  position: relative;
  width: 100%;
  max-width: 350px;
  min-width: 300px;
  padding: 14px 16px 14px 58px;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: all;
  cursor: grab;
  user-select: none;
  touch-action: none;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  line-height: 1.45;
  color: var(--fg-primary-color);
  /* Paper sheet: soft page gradient + faint ruled lines */
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 23px,
      color-mix(in srgb, var(--border-secondary-color) 45%, transparent) 23px,
      color-mix(in srgb, var(--border-secondary-color) 45%, transparent) 24px
    ),
    linear-gradient(
      100deg,
      color-mix(in srgb, var(--toast-accent) 7%, var(--bg-secondary-color)) 0%,
      var(--bg-secondary-color) 45%
    );
  border: 1px solid var(--border-primary-color);
  border-radius: 4px 12px 12px 4px;
  box-shadow:
    inset 3px 0 0 color-mix(in srgb, var(--toast-accent) 18%, transparent),
    0 1px 0 color-mix(in srgb, var(--border-primary-color) 60%, transparent),
    0 10px 24px -12px rgba(60, 40, 20, 0.35);
  transform-origin: right center;

  @include media-down(sm) {
    min-width: 0;
  }

  &:active {
    cursor: grabbing;
  }

  /* Bookmark ribbon hanging from the top edge */
  &-ribbon {
    position: absolute;
    top: -1px;
    left: 14px;
    width: 30px;
    height: calc(100% - 10px);
    min-height: 40px;
    max-height: 52px;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 8px;
    background: linear-gradient(
      to right,
      color-mix(in srgb, var(--toast-accent) 85%, black) 0%,
      var(--toast-accent) 30%,
      color-mix(in srgb, var(--toast-accent) 88%, white) 100%
    );
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 9px), 0 100%);
    color: var(--bg-secondary-color);
    filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.15));

    .ribbon-icon {
      width: 16px;
      height: 16px;
    }
  }

  &-detail {
    flex-grow: 1;
    min-width: 0;
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

  /* Reading progress: thin line at the page bottom showing time left */
  &-progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: var(--toast-accent);
    opacity: 0.55;
    transform-origin: left center;
    animation-name: kit-toast-progress;
    animation-timing-function: linear;
    animation-fill-mode: forwards;
  }

  .action-btn {
    align-self: flex-start;
    padding: 3px 12px;
    border: 1px solid color-mix(in srgb, var(--toast-accent) 55%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--toast-accent) 10%, transparent);
    color: var(--toast-accent);
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: color-mix(in srgb, var(--toast-accent) 20%, transparent);
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

@keyframes kit-toast-progress {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .kit-toast-item-progress {
    animation: none;
    display: none;
  }
}
</style>
