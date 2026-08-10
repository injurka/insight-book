<script setup lang="ts">
import type { Props } from './molecules/kit-pagination.vue'
import KitPagination from './molecules/kit-pagination.vue'

defineProps<Props>()
</script>

<template>
  <KitPagination v-bind="$props" />
</template>
