<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="kit-page-header">
    <div class="kit-page-header-heading">
      <slot name="navigation" />
      <div class="kit-page-header-title">
        <h1>{{ title }}</h1>
        <p v-if="subtitle">
          {{ subtitle }}
        </p>
      </div>
    </div>
    <div v-if="$slots.actions" class="kit-page-header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.kit-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &-heading {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  &-title {
    min-width: 0;

    h1 {
      margin: 0 0 8px;
      font-size: 2.2rem;
      font-weight: 700;
      line-height: 1.1;
      color: var(--fg-primary-color);
      overflow-wrap: anywhere;
    }

    p {
      margin: 0;
      font-size: 1rem;
      color: var(--fg-secondary-color);
    }

    @include media-down(sm) {
      h1 {
        margin: 0;
        font-size: 1.6rem;
      }

      p {
        display: none;
      }
    }
  }

  &-actions {
    flex-shrink: 0;
  }
}
</style>
