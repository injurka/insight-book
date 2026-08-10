<template>
  <div class="kit-form-group">
    <label v-if="$slots.label" class="kit-form-group__label"><slot name="label" /></label>
    <div class="kit-form-group__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.kit-form-group {
  margin-bottom: 16px;
}
.kit-form-group__label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-secondary-color, #8e867b);
  margin-bottom: 6px;
}
</style>
