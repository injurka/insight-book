<script setup lang="ts">
export interface Props {
  variant?:
    | 'primary'
    | 'success'
    | 'danger'
    | 'secondary'
    | 'ghost'
    | 'ghost-danger'
    | 'ghost-success'
    | 'subtle'
    | 'subtle-danger'
    | 'outline'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
  type: 'button',
})
</script>

<template>
  <v-btn
    class="kit-btn"
    :class="`kit-btn--${variant}`"
    :disabled="disabled"
    :type="type"
    elevation="0"
    v-bind="$attrs"
  >
    <span class="kit-btn__inner">
      <slot />
    </span>
  </v-btn>
</template>

<style scoped>
.kit-btn {
  text-transform: none;
  font-weight: 500;
  letter-spacing: normal;
  border-radius: 6px;
  min-width: 0 !important;
  min-height: auto;
  height: auto;
  padding: 6px 14px;
  transition: all 0.15s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: none !important;
}

.kit-btn__inner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1.2;
}

.kit-btn__inner :deep(svg) {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  font-size: 1.1em;
}

.kit-btn--primary {
  background-color: var(--bg-action-hover-color, #5a9c7b) !important;
  color: #ffffff !important;
}

.kit-btn--secondary {
  background-color: var(--bg-overlay-secondary-color, #d9d1c7) !important;
  color: var(--fg-primary-color, #4a443c) !important;
}

.kit-btn--success {
  background-color: var(--fg-success-color, #4b8266) !important;
  color: #ffffff !important;
}

.kit-btn--danger {
  background-color: var(--fg-error-color, #c46d6d) !important;
  color: #ffffff !important;
}

.kit-btn--ghost {
  background-color: transparent !important;
  color: var(--fg-secondary-color, #8e867b) !important;
}

.kit-btn--ghost:hover:not(:disabled) {
  background-color: var(--bg-hover-color, #d9d1c7) !important;
  color: var(--fg-primary-color, #4a443c) !important;
}

.kit-btn--ghost-danger,
.kit-btn--subtle-danger {
  background-color: transparent !important;
  color: var(--fg-secondary-color, #8e867b) !important;
}

.kit-btn--ghost-danger:hover:not(:disabled),
.kit-btn--subtle-danger:hover:not(:disabled) {
  background-color: rgba(196, 109, 109, 0.15) !important;
  color: var(--fg-error-color, #c46d6d) !important;
}

.kit-btn--ghost-success,
.kit-btn--subtle-success {
  background-color: transparent !important;
  color: var(--fg-secondary-color, #8e867b) !important;
}

.kit-btn--ghost-success:hover:not(:disabled),
.kit-btn--subtle-success:hover:not(:disabled) {
  background-color: rgba(75, 130, 102, 0.15) !important;
  color: var(--fg-success-color, #4b8266) !important;
}

.kit-btn--subtle {
  background-color: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.12)) !important;
  color: var(--fg-primary-color, #4a443c) !important;
}

.kit-btn--subtle:hover:not(:disabled) {
  background-color: var(--bg-hover-color, #d9d1c7) !important;
}

.kit-btn--outline {
  background-color: transparent !important;
  border: 1px solid var(--border-primary-color, #c7c0b6) !important;
  color: var(--fg-primary-color, #4a443c) !important;
}

.kit-btn--outline:hover:not(:disabled) {
  background-color: var(--bg-hover-color, rgba(142, 134, 123, 0.1)) !important;
}

.kit-btn:hover:not(:disabled) {
  opacity: 0.95;
  transform: translateY(-1px);
}
</style>
