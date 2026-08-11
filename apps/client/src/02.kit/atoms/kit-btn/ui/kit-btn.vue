<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, useSlots } from 'vue'
import { useHaptic } from '~/01.shared/composables/use-haptic'
import { vRipple } from '~/01.shared/directives/ripple'

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
  type?: 'button' | 'submit' | 'reset'
  ripple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'solid',
  color: 'primary',
  disabled: false,
  loading: false,
  size: 'md',
  density: 'default',
  type: 'button',
  ripple: true,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const { hapticLight } = useHaptic()
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

function handleClick(event: MouseEvent) {
  if (props.disabled || props.loading)
    return

  hapticLight()
  emit('click', event)
}
</script>

<template>
  <button
    v-ripple="props.ripple"
    :class="componentClasses"
    :disabled="props.disabled || props.loading"
    :type="props.type"
    @click="handleClick"
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

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
  }

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
    &.kit-btn--color-primary,
    &.kit-btn--color-accent {
      background-color: var(--fg-accent-color);
      border-color: var(--fg-accent-color);
      color: var(--fg-inverted-color);
      &:hover {
        background-color: var(--fg-action-color);
        border-color: var(--fg-action-color);
      }
    }
    &.kit-btn--color-secondary {
      background-color: var(--bg-tertiary-color);
      border-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
      &:hover {
        background-color: var(--bg-hover-color);
        border-color: var(--bg-hover-color);
      }
    }
    @each $name in (error, success, warning, info) {
      &.kit-btn--color-#{$name} {
        background-color: var(--fg-#{$name}-color);
        border-color: var(--fg-#{$name}-color);
        color: var(--fg-inverted-color);
        &:hover {
          filter: brightness(1.1);
        }
      }
    }
  }

  &--tonal {
    border: none;
    &.kit-btn--color-primary,
    &.kit-btn--color-secondary,
    &.kit-btn--color-accent {
      background-color: var(--bg-tertiary-color);
      color: var(--fg-primary-color);
      &:hover {
        background-color: var(--bg-hover-color);
      }
    }
    @each $name, $rgb in (error: '248, 81, 73', success: '86, 211, 100', warning: '227, 179, 65', info: '118, 227, 234')
    {
      &.kit-btn--color-#{$name} {
        background-color: rgba(var(--bg-#{$name}-color-rgb, #{$rgb}), 0.15);
        color: var(--fg-#{$name}-color);
        &:hover {
          background-color: rgba(var(--bg-#{$name}-color-rgb, #{$rgb}), 0.25);
        }
      }
    }
  }

  &--outlined {
    background-color: transparent;
    box-shadow: none;

    &.kit-btn--color-primary,
    &.kit-btn--color-secondary,
    &.kit-btn--color-accent {
      border: 1px solid var(--border-primary-color);
      color: var(--fg-primary-color);
      &:hover {
        border-color: var(--fg-accent-color);
        color: var(--fg-accent-color);
      }
    }

    @each $name, $rgb in (error: '248, 81, 73', success: '86, 211, 100', warning: '227, 179, 65', info: '118, 227, 234')
    {
      &.kit-btn--color-#{$name} {
        border: 1px solid var(--fg-#{$name}-color);
        color: var(--fg-#{$name}-color);
        &:hover {
          background-color: rgba(var(--bg-#{$name}-color-rgb, #{$rgb}), 0.1);
        }
      }
    }
  }

  &--text {
    background-color: transparent;
    box-shadow: none;
    border-color: transparent;

    &.kit-btn--color-primary,
    &.kit-btn--color-secondary {
      color: var(--fg-primary-color);
      &:hover {
        background-color: var(--bg-hover-color);
      }
    }
    &.kit-btn--color-accent {
      color: var(--fg-accent-color);
      &:hover {
        background-color: var(--bg-hover-color);
      }
    }

    @each $name, $rgb in (error: '248, 81, 73', success: '86, 211, 100', warning: '227, 179, 65', info: '118, 227, 234')
    {
      &.kit-btn--color-#{$name} {
        color: var(--fg-#{$name}-color);
        &:hover {
          background-color: rgba(var(--bg-#{$name}-color-rgb, #{$rgb}), 0.1);
        }
      }
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
