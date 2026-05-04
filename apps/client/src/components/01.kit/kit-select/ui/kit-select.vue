<script setup lang="ts">
interface Option {
  label: string
  value: string | number
}

interface Props {
  modelValue: string | number
  options: Option[]
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  size: 'md',
})

const emit = defineEmits(['update:modelValue'])

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <div class="kit-select-wrapper">
    <select
      :value="modelValue"
      class="kit-select"
      :class="`kit-select--size-${size}`"
      @change="onChange"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
    <div class="kit-select-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.kit-select-wrapper {
  position: relative;
  width: 100%;
}

.kit-select {
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
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;

  padding-right: 36px;

  &:focus {
    border-color: var(--fg-accent-color);
  }

  &--size-xs {
    height: 28px;
    padding-left: 8px;
    font-size: 0.8rem;
  }

  &--size-sm {
    height: 32px;
    padding-left: 10px;
    font-size: 0.85rem;
  }

  &--size-md {
    height: 38px;
    padding-left: 12px;
    font-size: 0.875rem;
  }

  &--size-lg {
    height: 44px;
    padding-left: 16px;
    font-size: 1rem;
  }
}

.kit-select-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--fg-secondary-color);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
