<script setup lang="ts">
import type { Props } from './atoms/kit-skeleton.vue'
import KitSkeleton from './atoms/kit-skeleton.vue'

defineProps<Props>()
</script>

<template>
  <KitSkeleton v-bind="$props" />
</template>
