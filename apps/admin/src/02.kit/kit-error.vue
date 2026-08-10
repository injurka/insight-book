<script setup lang="ts">
import type { Props } from './organisms/kit-error.vue'
import KitError from './organisms/kit-error.vue'

defineProps<Props>()
</script>

<template>
  <KitError v-bind="$props" />
</template>
