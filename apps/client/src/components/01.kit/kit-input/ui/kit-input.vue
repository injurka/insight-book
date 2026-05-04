<script setup lang="ts">
interface Props {
  modelValue: string
  placeholder?: string
  rounded?: boolean
  variant?: 'default' | 'solo'
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

withDefaults(defineProps<Props>(), {
  placeholder: '',
  variant: 'default',
  size: 'md',
})

const emit = defineEmits(['update:modelValue'])

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="kit-input-wrapper" :class="{ 'is-rounded': rounded, 'is-solo': variant === 'solo' }">
    <input
      :value="modelValue"
      type="text"
      class="kit-input"
      :class="`kit-input--size-${size}`"
      :placeholder="placeholder"
      @input="onInput"
    >
  </div>
</template>

<style lang="scss" scoped>
.kit-input-wrapper {
  position: relative;
  width: 100%;

  &.is-rounded .kit-input {
    border-radius: 9999px;
  }

  &.is-solo .kit-input {
    background-color: var(--bg-secondary-color);
    border: none;
    box-shadow: none;
  }
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
    box-shadow 0.2s;

  &::placeholder {
    color: var(--fg-muted-color);
    opacity: 1;
  }

  &:focus {
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
}
</style>
