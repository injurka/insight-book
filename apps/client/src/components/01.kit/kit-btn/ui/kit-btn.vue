<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { vRipple } from '~/shared/directives/ripple'

interface Props {
  icon?: string
  prependIcon?: string
  appendIcon?: string
  variant?: 'solid' | 'outlined' | 'text' | 'subtle' | 'tonal'
  color?: 'primary' | 'secondary' | 'accent' | 'error' | 'success' | 'warning' | 'info'
  disabled?: boolean
  loading?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  density?: 'default' | 'compact'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'solid',
  color: 'primary',
  disabled: false,
  loading: false,
  size: 'md',
  density: 'default',
})

const slots = useSlots()

const isIconOnly = computed(() => (props.loading || props.icon || props.prependIcon) && !slots.default && !props.appendIcon)
const finalIcon = computed(() => props.loading ? 'mdi:loading' : (props.icon || props.prependIcon))

const componentClasses = computed(() => [
  'kit-btn',
  `kit-btn--${props.variant}`,
  `kit-btn--color-${props.color}`,
  `kit-btn--size-${props.size}`,
  `kit-btn--density-${props.density}`,
  { 'kit-btn--icon-only': isIconOnly.value },
])
</script>

<template>
  <button
    v-ripple
    :class="componentClasses"
    :disabled="props.disabled || props.loading"
    type="button"
  >
    <span class="kit-btn-content">
      <Icon
        v-if="finalIcon"
        :icon="finalIcon"
        class="kit-btn-icon"
        :class="{
          'mr-2': !isIconOnly && slots.default,
          'kit-btn-icon--spin': props.loading,
        }"
      />
      <slot />
      <Icon v-if="props.appendIcon" :icon="props.appendIcon" class="kit-btn-icon ml-2" />
    </span>
  </button>
</template>

<style lang="scss">
.kit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  user-select: none;
  border: 1px solid transparent;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease-in-out;
  box-shadow: var(--s-s);
  white-space: nowrap;
  flex-shrink: 0;

  & * {
    pointer-events: none;
  }

  &:not(.kit-btn--text):not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: var(--s-l);
  }

  &:not(.kit-btn--text):not(:disabled):active {
    transform: translateY(0px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    transform: none;
    box-shadow: none;
    background-color: var(--bg-disabled-color) !important;
    color: var(--fg-disabled-color) !important;
    border-color: var(--fg-disabled-color) !important;
  }

  &--size-xs {
    height: 28px;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    border-radius: 4px;
    &.kit-btn--icon-only {
      padding: 0;
      width: 28px;
    }
  }

  &--size-sm {
    height: 32px;
    padding: 0 0.75rem;
    font-size: 0.85rem;
    border-radius: 6px;
    &.kit-btn--icon-only {
      padding: 0;
      width: 32px;
    }
  }

  &--size-md {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    border-radius: 6px;
    height: 38px;
    &.kit-btn--icon-only {
      padding: 0;
      width: 38px;
    }
  }

  &--size-lg {
    height: 44px;
    padding: 0.75rem 1.25rem;
    font-size: 1rem;
    border-radius: 8px;
    &.kit-btn--icon-only {
      padding: 0;
      width: 44px;
    }
  }

  &--density-compact {
    height: 28px !important;
    padding: 0 8px;
    font-size: 0.8rem;

    &.kit-btn--icon-only {
      width: 28px;
      padding: 0;
    }
  }

  &--solid {
    &.kit-btn--color-primary {
      background-color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);
      &:hover {
        background-color: var(--fg-action-color);
      }
    }
  }

  &--tonal {
    border: none;
    &.kit-btn--color-primary,
    &.kit-btn--color-secondary {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
      &:hover {
        background-color: var(--bg-hover-color);
      }
    }
    &.kit-btn--color-error {
      background-color: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.15);
      color: var(--fg-error-color);
      &:hover {
        background-color: rgba(var(--bg-error-color-rgb, 248, 81, 73), 0.25);
      }
    }
    &.kit-btn--color-success {
      background-color: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.15);
      color: var(--fg-success-color);
      &:hover {
        background-color: rgba(var(--bg-success-color-rgb, 86, 211, 100), 0.25);
      }
    }
    &.kit-btn--color-warning {
      background-color: rgba(var(--bg-warning-color-rgb, 227, 179, 65), 0.15);
      color: var(--fg-warning-color);
      &:hover {
        background-color: rgba(var(--bg-warning-color-rgb, 227, 179, 65), 0.25);
      }
    }
    &.kit-btn--color-info {
      background-color: rgba(var(--bg-info-color-rgb, 118, 227, 234), 0.15);
      color: var(--fg-info-color);
      &:hover {
        background-color: rgba(var(--bg-info-color-rgb, 118, 227, 234), 0.25);
      }
    }
  }

  &--outlined {
    background-color: transparent;
    border: 1px solid var(--border-primary-color);
    color: var(--fg-primary-color);
    box-shadow: none;
    &:hover {
      border-color: var(--fg-accent-color);
      color: var(--fg-accent-color);
    }
  }

  &--text {
    background-color: transparent;
    box-shadow: none;
    border-color: transparent;
    color: var(--fg-primary-color);

    &.kit-btn--color-accent {
      color: var(--fg-accent-color);
    }
    &:hover {
      background-color: var(--bg-hover-color);
    }
  }

  &-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  &-icon {
    flex-shrink: 0;
    font-size: 1.45em;

    &--spin {
      animation: kit-btn-spin 1s linear infinite;
    }
  }

  .mr-2 {
    margin-right: 0.5rem;
  }
  .ml-2 {
    margin-left: 0.5rem;
  }
}

@keyframes kit-btn-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
