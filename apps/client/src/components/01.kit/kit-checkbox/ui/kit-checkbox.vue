<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  label?: string
}

defineProps<Props>()
const model = defineModel()

function toggle() {
  model.value = !model.value
}
</script>

<template>
  <div class="kit-checkbox" @click="toggle">
    <div class="checkbox-box" :class="{ checked: modelValue }">
      <Icon v-if="modelValue" icon="mdi:check" size="14" style="color: white;" />
    </div>
    <span v-if="label" class="checkbox-label">{{ label }}</span>
  </div>
</template>

<style lang="scss" scoped>
.kit-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;

  &:hover .checkbox-box {
    border-color: var(--fg-accent-color);
  }
}

.checkbox-box {
  width: 18px;
  height: 18px;
  border: 2px solid var(--fg-secondary-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  transition: all 0.2s;

  &.checked {
    background-color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.checkbox-label {
  font-size: 0.9rem;
  color: var(--fg-primary-color);
}
</style>
