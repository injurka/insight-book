<script setup lang="ts">
export interface Props {
  page: number
  totalPages: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:page': [page: number]
}>()
</script>

<template>
  <div v-if="totalPages > 1" class="kit-pagination">
    <v-pagination
      :model-value="props.page"
      :length="props.totalPages"
      :total-visible="7"
      density="compact"
      active-color="primary"
      class="kit-pagination__v"
      @update:model-value="emit('update:page', $event)"
    />
  </div>
</template>

<style scoped>
.kit-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
}

.kit-pagination__v :deep(.v-btn) {
  border-radius: 6px !important;
  font-size: 13px !important;
  font-weight: 500 !important;
}

.kit-pagination__v :deep(.v-btn--active) {
  background-color: var(--bg-action-hover-color, #5a9c7b) !important;
  color: #ffffff !important;
}
</style>
