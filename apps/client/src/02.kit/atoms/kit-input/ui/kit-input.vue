<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, useSlots } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  variant: 'default',
  size: 'md',
  color: 'default',
  clearable: false,
  type: 'text',
})

interface Props {
  placeholder?: string
  rounded?: boolean
  variant?: 'default' | 'solo'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: 'primary' | 'secondary' | 'accent' | 'error' | 'success' | 'warning' | 'info' | 'default'
  icon?: string
  prependIcon?: string
  appendIcon?: string
  clearable?: boolean
  type?: string
}

const modelValue = defineModel<string | number | null>({ default: '' })

const slots = useSlots()

const finalPrependIcon = computed(() => props.icon || props.prependIcon)
const hasPrepend = computed(() => !!finalPrependIcon.value || !!slots.prepend || !!slots.icon)
const hasAppend = computed(() => (props.clearable && modelValue.value !== '' && modelValue.value !== null) || !!props.appendIcon || !!slots.append)

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value

  if (props.type === 'number')
    modelValue.value = val === '' ? null : Number(val)
  else
    modelValue.value = val
}

function clear() {
  modelValue.value = props.type === 'number' ? null : ''
}
</script>

<template>
  <div
    class="kit-input-wrapper"
    :class="[
      {
        'is-rounded': rounded,
        'is-solo': variant === 'solo',
        'has-prepend': hasPrepend,
        'has-append': hasAppend,
      },
      color && color !== 'default' ? `kit-input-wrapper--color-${color}` : '',
    ]"
  >
    <span v-if="hasPrepend" class="kit-input-prepend">
      <slot name="prepend">
        <slot name="icon">
          <Icon v-if="finalPrependIcon" :icon="finalPrependIcon" class="kit-input-icon" />
        </slot>
      </slot>
    </span>

    <input
      v-bind="$attrs"
      :value="modelValue ?? ''"
      :type="type"
      class="kit-input"
      :class="[
        `kit-input--size-${size}`,
        color && color !== 'default' ? `kit-input--color-${color}` : '',
      ]"
      :placeholder="placeholder"
      :data-tracking-mask="type === 'password' ? 'true' : undefined"
      @input="onInput"
    >

    <span v-if="hasAppend" class="kit-input-append">
      <slot name="append">
        <button
          v-if="clearable && modelValue !== '' && modelValue !== null"
          type="button"
          class="kit-input-clear-btn"
          aria-label="Clear input"
          @click="clear"
        >
          <Icon icon="mdi:close-circle" class="kit-input-icon" />
        </button>
        <Icon v-else-if="props.appendIcon" :icon="props.appendIcon" class="kit-input-icon" />
      </slot>
    </span>
  </div>
</template>

<style lang="scss" scoped>
.kit-input-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;

  &.is-rounded .kit-input {
    border-radius: 9999px;
  }

  &.is-solo .kit-input {
    background-color: var(--bg-secondary-color);
    border: none;
    box-shadow: none;
  }

  &.has-prepend {
    .kit-input--size-xs {
      padding-left: 28px;
    }
    .kit-input--size-sm {
      padding-left: 32px;
    }
    .kit-input--size-md {
      padding-left: 36px;
    }
    .kit-input--size-lg {
      padding-left: 42px;
    }
  }

  &.has-append {
    .kit-input--size-xs {
      padding-right: 28px;
    }
    .kit-input--size-sm {
      padding-right: 32px;
    }
    .kit-input--size-md {
      padding-right: 36px;
    }
    .kit-input--size-lg {
      padding-right: 42px;
    }
  }
}

.kit-input-prepend,
.kit-input-append {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-secondary-color);
  pointer-events: none;
  z-index: 1;
}

.kit-input-prepend {
  left: 10px;
}

.kit-input-append {
  right: 10px;
}

.kit-input-clear-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  color: var(--fg-muted-color);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  transition: color 0.2s ease;

  &:hover {
    color: var(--fg-primary-color);
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.kit-input-icon {
  font-size: 1.25em;
  flex-shrink: 0;
}

.kit-input {
  appearance: none;
  margin: 0;
  box-sizing: border-box;
  width: 100%;
  font-family: inherit;

  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 6px;
  outline: none;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    box-shadow 0.2s;

  &::placeholder {
    color: var(--fg-muted-color);
    opacity: 1;
  }

  &:focus {
    border-color: var(--fg-accent-color);
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 1px;
    border-color: var(--fg-accent-color);
  }

  &--size-xs {
    height: 28px;
    padding: 0 8px;
    font-size: 0.8rem;
    line-height: 26px;
  }

  &--size-sm {
    height: 32px;
    padding: 0 10px;
    font-size: 0.85rem;
    line-height: 30px;
  }

  &--size-md {
    height: 38px;
    padding: 0 12px;
    font-size: 0.875rem;
    line-height: 36px;
  }

  &--size-lg {
    height: 44px;
    padding: 0 16px;
    font-size: 1rem;
    line-height: 42px;
  }

  &--color-primary {
    background-color: rgba(var(--bg-primary-color-rgb, 13, 17, 23), 0.75);
    background-color: color-mix(in srgb, var(--bg-primary-color) 75%, transparent);
  }

  &--color-secondary {
    background-color: rgba(var(--bg-secondary-color-rgb, 22, 27, 34), 0.75);
    background-color: color-mix(in srgb, var(--bg-secondary-color) 75%, transparent);
  }

  &--color-accent {
    background-color: rgba(var(--bg-accent-color-rgb, 48, 33, 61), 0.75);
    background-color: color-mix(in srgb, var(--bg-accent-color) 75%, transparent);
  }

  @each $name in (error, success, warning, info) {
    &--color-#{$name} {
      background-color: rgba(var(--bg-#{$name}-color-rgb), 0.75);
      background-color: color-mix(in srgb, var(--bg-#{$name}-color) 75%, transparent);
    }
  }
}
</style>
