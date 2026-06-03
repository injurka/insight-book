<script setup lang="ts">
import '@aejkatappaja/phantom-ui'

interface Props {
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})
</script>

<template>
  <phantom-ui class="kit-skeleton-phantom" :loading="loading ? '' : undefined">
    <slot />
  </phantom-ui>
</template>

<style lang="scss" scoped>
.kit-skeleton-phantom {
  display: block;
  width: 100%;

  --shimmer-color: rgba(128, 128, 128, 0.15);

  --block-color: var(--bg-tertiary-color);

  --shimmer-duration: 1.5s;
}
</style>
