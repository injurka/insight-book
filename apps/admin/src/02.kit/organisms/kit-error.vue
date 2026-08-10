<script setup lang="ts">
export interface Props {
  message?: string
}

defineProps<Props>()
</script>

<template>
  <v-alert
    class="kit-error"
    type="error"
    variant="tonal"
    density="compact"
    elevation="0"
  >
    {{ message || 'Произошла ошибка' }}
  </v-alert>
</template>

<style scoped>
.kit-error {
  margin-top: 12px;
  margin-bottom: 12px;
  border-radius: 6px;
  background-color: var(--bg-error-color, #f5e3e3) !important;
  color: var(--fg-error-color, #c46d6d) !important;
  font-size: 14px;
}
</style>
