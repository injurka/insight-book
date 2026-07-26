<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  title: string
  description?: string
  icon?: string
  iconClass?: string
  wrapperClass?: string
  noIcon?: boolean
}>()
</script>

<template>
  <div class="step-card">
    <div v-if="!noIcon" class="step-icon-wrapper" :class="wrapperClass">
      <Icon
        v-if="icon"
        :icon="icon"
        class="huge-icon"
        :class="iconClass"
      />
      <slot v-else name="icon" />
    </div>

    <h1 v-if="!noIcon" class="title">
      {{ title }}
    </h1>
    <h2 v-else class="title">
      {{ title }}
    </h2>

    <p v-if="description" class="description">
      {{ description }}
    </p>
    <slot name="description" />

    <slot />
  </div>
</template>

<style lang="scss" scoped>
.step-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  padding-bottom: 48px;
  min-height: 540px;
}

.step-icon-wrapper {
  margin-bottom: 32px;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary-color);
  border-radius: 50%;
  border: 2px solid var(--border-secondary-color);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;

  .huge-icon {
    font-size: 4rem;
    color: var(--fg-primary-color);
  }
}

.title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 16px 0;
  color: var(--fg-primary-color);
}

.description {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--fg-secondary-color);
  margin: 0 0 32px 0;
  max-width: 480px;
}
</style>

<style lang="scss">
.step-card .interactive-zone {
  background-color: rgba(150, 150, 150, 0.08);
  border: 2px dashed var(--border-secondary-color);
  border-radius: 16px;
}
</style>
