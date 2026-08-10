<script setup lang="ts">
import type { Props } from './organisms/kit-stat-card.vue'
import KitStatCard from './organisms/kit-stat-card.vue'

defineProps<Props>()
</script>

<template>
  <KitStatCard v-bind="$props" />
</template>
