<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface ToggleOption {
  value: unknown
  icon?: string
  label?: string
  tooltip?: string
}

withDefaults(defineProps<Props>(), {
  size: 'sm',
})

const modelValue = defineModel<unknown>()

interface Props {
  options: ToggleOption[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

function select(value: unknown) {
  modelValue.value = value
}
</script>

<template>
  <div class="kit-toggle" role="group" :class="[`kit-toggle--size-${size}`]">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      class="kit-toggle-btn"
      :class="{ 'is-active': modelValue === opt.value }"
      :aria-pressed="modelValue === opt.value"
      :aria-label="opt.label || opt.tooltip"
      :title="opt.tooltip || opt.label"
      @click="select(opt.value)"
    >
      <Icon v-if="opt.icon" :icon="opt.icon" class="kit-toggle-icon" />
      <span v-if="opt.label" class="kit-toggle-label">{{ opt.label }}</span>
    </button>
  </div>
</template>

<style lang="scss" scoped>
.kit-toggle {
  display: inline-flex;
  gap: 2px;
  background: var(--bg-secondary-color, #f3f4f6);
  padding: 2px;
  border-radius: 6px;
  align-items: center;
}

.kit-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--fg-secondary-color);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease-in-out;
  padding: 0;

  &:hover {
    color: var(--fg-primary-color);
    background: var(--bg-hover-color, rgba(0, 0, 0, 0.05));
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 1px;
  }

  &.is-active {
    background: var(--bg-tertiary-color, #e5e7eb);
    color: var(--fg-primary-color);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
}

.kit-toggle--size-xs {
  .kit-toggle-btn {
    min-width: 24px;
    height: 20px;
    font-size: 0.75rem;
    padding: 0 4px;
  }
  .kit-toggle-icon {
    width: 12px;
    height: 12px;
  }
}

.kit-toggle--size-sm {
  .kit-toggle-btn {
    min-width: 28px;
    height: 24px;
    font-size: 0.85rem;
    padding: 0 6px;
  }
  .kit-toggle-icon {
    width: 14px;
    height: 14px;
  }
}

.kit-toggle--size-md {
  .kit-toggle-btn {
    min-width: 36px;
    height: 32px;
    font-size: 0.9rem;
    padding: 0 8px;
  }
  .kit-toggle-icon {
    width: 16px;
    height: 16px;
  }
}

.kit-toggle--size-lg {
  .kit-toggle-btn {
    min-width: 44px;
    height: 40px;
    font-size: 1rem;
    padding: 0 12px;
  }
  .kit-toggle-icon {
    width: 20px;
    height: 20px;
  }
}
</style>
