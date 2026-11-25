<script setup lang="ts">
import { Icon } from '@iconify/vue'

export interface Props {
  title: string
  icon?: string
}

defineProps<Props>()
</script>

<template>
  <section class="kit-panel">
    <header class="kit-panel__head">
      <div class="kit-panel__title-group">
        <Icon v-if="icon" :icon="icon" class="kit-panel__icon" />
        <h2 class="kit-panel__title">
          {{ title }}
        </h2>
      </div>
      <div v-if="$slots.meta" class="kit-panel__meta">
        <slot name="meta" />
      </div>
    </header>
    <div class="kit-panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.kit-panel {
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 10px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.kit-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.kit-panel__title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.kit-panel__icon {
  font-size: 20px;
  color: var(--fg-accent-color, #4b8266);
  flex-shrink: 0;
}

.kit-panel__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
}

.kit-panel__meta {
  font-size: 12px;
  color: var(--fg-secondary-color, #8e867b);
  flex-shrink: 0;
}

.kit-panel__body {
  min-width: 0;
}
</style>
