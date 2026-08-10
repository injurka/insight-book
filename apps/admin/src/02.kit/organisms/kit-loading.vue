<script setup lang="ts">
import KitSkeleton from '../atoms/kit-skeleton.vue'

export interface Props {
  type?: 'text' | 'table-row' | 'card' | 'form-item'
  count?: number
}

withDefaults(defineProps<Props>(), {
  type: 'table-row',
  count: 4,
})
</script>

<template>
  <div class="kit-loading">
    <KitSkeleton :type="type" :count="count" />
  </div>
</template>

<style scoped>
.kit-loading {
  width: 100%;
  padding: 12px 0;
}
</style>
