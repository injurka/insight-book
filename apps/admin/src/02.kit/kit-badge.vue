<script setup lang="ts">
import type { Props } from './atoms/kit-badge.vue'
import KitBadge from './atoms/kit-badge.vue'

defineProps<Props>()
</script>

<template>
  <KitBadge v-bind="$props">
    <slot />
  </KitBadge>
</template>
