<script setup lang="ts">
import type { Props } from './organisms/kit-loading.vue'
import KitLoading from './organisms/kit-loading.vue'

defineProps<Props>()
</script>

<template>
  <KitLoading v-bind="$props" />
</template>
