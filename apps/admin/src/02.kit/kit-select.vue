<script setup lang="ts">
import type { Props } from './molecules/kit-select.vue'
import KitSelect from './molecules/kit-select.vue'

defineProps<Props>()
</script>

<template>
  <KitSelect v-bind="$props" />
</template>
