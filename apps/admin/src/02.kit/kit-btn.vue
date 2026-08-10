<script setup lang="ts">
import type { Props } from './atoms/kit-btn.vue'
import KitBtn from './atoms/kit-btn.vue'

defineProps<Props>()
</script>

<template>
  <KitBtn v-bind="$props">
    <slot />
  </KitBtn>
</template>
