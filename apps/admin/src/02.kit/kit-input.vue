<script setup lang="ts">
import type { Props } from './atoms/kit-input.vue'
import KitInput from './atoms/kit-input.vue'

defineProps<Props>()
</script>

<template>
  <KitInput v-bind="$props" />
</template>
