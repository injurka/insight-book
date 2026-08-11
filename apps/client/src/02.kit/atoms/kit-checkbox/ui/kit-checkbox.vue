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
  <div
    class="kit-checkbox"
    role="checkbox"
    tabindex="0"
    :aria-checked="!!model"
    :aria-label="label"
    @click="toggle"
    @keydown.space.prevent="toggle"
    @keydown.enter.prevent="toggle"
  >
    <div class="checkbox-box" :class="{ checked: model }">
      <Icon
        v-if="model"
        icon="mdi:check"
        size="14"
        style="color: white;"
      />
    </div>
    <span v-if="label" class="checkbox-label">{{ label }}</span>
  </div>
</template>

<style lang="scss" scoped>
.kit-checkbox {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  padding: 4px 6px;
  gap: 8px;
  border-radius: 6px;
  outline: none;

  &:hover .checkbox-box {
    border-color: var(--fg-accent-color);
  }

  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 2px;
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
  transition: all 0.2s;
  flex-shrink: 0;

  &.checked {
    background-color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
  }
}

.checkbox-label {
  font-size: 0.95rem;
  color: var(--fg-primary-color);
}
</style>
