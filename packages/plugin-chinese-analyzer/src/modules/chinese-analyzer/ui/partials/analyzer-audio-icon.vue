<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  icon: string
  loading: boolean
}

defineProps<Props>()
</script>

<template>
  <Icon :icon="loading ? 'mdi:loading' : icon" :class="{ 'is-spinning': loading }" aria-hidden="true" />
</template>

<style scoped lang="scss">
@media (prefers-reduced-motion: no-preference) {
  .is-spinning {
    animation: spin 0.9s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
