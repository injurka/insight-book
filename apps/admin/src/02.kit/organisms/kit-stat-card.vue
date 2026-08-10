<script setup lang="ts">
export interface Props {
  value: string | number
  label: string
  valueColor?: string
}

defineProps<Props>()
</script>

<template>
  <v-card class="kit-stat-card" elevation="0">
    <div class="kit-stat-card__value" :style="valueColor ? { color: valueColor } : {}">
      {{ value }}
    </div>
    <div class="kit-stat-card__label">
      {{ label }}
    </div>
  </v-card>
</template>

<style scoped>
.kit-stat-card {
  background: var(--bg-secondary-color, #e8e2d9) !important;
  border: 1px solid var(--border-secondary-color, #d9d1c7) !important;
  border-radius: 8px !important;
  padding: 20px;
  text-align: center;
  flex: 1 1 200px;
  min-width: 200px;
  box-sizing: border-box;
}
.kit-stat-card__value {
  font-size: 32px;
  font-weight: 700;
  line-height: 38px;
  height: 38px;
  color: var(--fg-highlight-color, #c2a14d);
}
.kit-stat-card__label {
  font-size: 13px;
  line-height: 16px;
  height: 16px;
  color: var(--fg-secondary-color, #8e867b);
  margin-top: 4px;
}
</style>
