<script setup lang="ts">
export interface Props {
  type?: 'text' | 'table-row' | 'table' | 'card' | 'stat-card' | 'avatar' | 'form-item'
  count?: number
  height?: string | number
  width?: string | number
}

withDefaults(defineProps<Props>(), {
  type: 'text',
  count: 1,
})
</script>

<template>
  <div
    class="kit-skeleton-group"
    :class="{ 'kit-skeleton-group--card': type === 'card' || type === 'stat-card' }"
  >
    <template v-if="type === 'table-row' || type === 'table'">
      <div class="kit-skeleton-table">
        <div class="kit-skeleton-table-header">
          <div class="kit-skeleton-cell" style="width: 6%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone--header" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 22%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone--header" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 24%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone--header" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 12%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone--header" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 12%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone--header" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 14%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone--header" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 10%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone--header" elevation="0" />
          </div>
        </div>
        <div v-for="i in count" :key="i" class="kit-skeleton-table-row">
          <div class="kit-skeleton-cell" style="width: 6%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 22%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 24%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 12%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 12%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 14%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone" elevation="0" />
          </div>
          <div class="kit-skeleton-cell" style="width: 10%">
            <v-skeleton-loader type="text" class="kit-skeleton-bg kit-skeleton-cell-bone" elevation="0" />
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="type === 'card' || type === 'stat-card'">
      <div v-for="i in count" :key="i" class="kit-skeleton-card">
        <v-skeleton-loader
          type="heading"
          class="kit-skeleton-bg kit-skeleton-card__value"
          elevation="0"
        />
        <v-skeleton-loader
          type="text"
          class="kit-skeleton-bg kit-skeleton-card__label"
          elevation="0"
        />
      </div>
    </template>

    <template v-else-if="type === 'form-item'">
      <div v-for="i in count" :key="i" class="kit-skeleton-form-item">
        <v-skeleton-loader
          type="text"
          class="kit-skeleton-bg kit-skeleton-form-label"
          elevation="0"
        />
        <v-skeleton-loader
          type="text"
          class="kit-skeleton-bg kit-skeleton-form-input"
          elevation="0"
        />
      </div>
    </template>

    <template v-else>
      <v-skeleton-loader
        v-for="i in count"
        :key="i"
        type="text"
        class="kit-skeleton-bg"
        :height="height"
        :width="width"
        elevation="0"
      />
    </template>
  </div>
</template>

<style scoped>
.kit-skeleton-group {
  width: 100%;
}

.kit-skeleton-group--card {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

/* Table Skeleton */
.kit-skeleton-table {
  width: 100%;
}

.kit-skeleton-table-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 12px;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
  box-sizing: border-box;
}

.kit-skeleton-table-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 12px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  box-sizing: border-box;
}

.kit-skeleton-cell {
  display: flex;
  align-items: center;
}

.kit-skeleton-cell-bone--header {
  width: 100%;
  height: 12px;
}

.kit-skeleton-cell-bone--header :deep(.v-skeleton-loader__bone) {
  height: 12px !important;
  width: 100% !important;
  border-radius: 3px !important;
  margin: 0 !important;
}

.kit-skeleton-cell-bone {
  width: 100%;
  height: 16px;
}

.kit-skeleton-cell-bone :deep(.v-skeleton-loader__bone) {
  height: 16px !important;
  width: 100% !important;
  border-radius: 4px !important;
  margin: 0 !important;
}

/* Card Skeleton */
.kit-skeleton-card {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  background: var(--bg-secondary-color, #e8e2d9);
  padding: 20px;
  flex: 1 1 200px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.kit-skeleton-card__value {
  width: 60px;
  height: 38px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.kit-skeleton-card__value :deep(.v-skeleton-loader__bone) {
  height: 38px !important;
  width: 100% !important;
  border-radius: 6px !important;
  margin: 0 !important;
}

.kit-skeleton-card__label {
  width: 120px;
  height: 16px;
  margin-top: 4px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.kit-skeleton-card__label :deep(.v-skeleton-loader__bone) {
  height: 16px !important;
  width: 100% !important;
  border-radius: 4px !important;
  margin: 0 !important;
}

/* Form Item Skeleton */
.kit-skeleton-form-item {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kit-skeleton-form-label {
  width: 110px;
  height: 14px;
}

.kit-skeleton-form-label :deep(.v-skeleton-loader__bone) {
  height: 14px !important;
  width: 100% !important;
  border-radius: 4px !important;
  margin: 0 !important;
}

.kit-skeleton-form-input {
  width: 100%;
  height: 38px;
}

.kit-skeleton-form-input :deep(.v-skeleton-loader__bone) {
  height: 38px !important;
  width: 100% !important;
  border-radius: 6px !important;
  margin: 0 !important;
  border: 1px solid var(--border-secondary-color, #d9d1c7);
}

/* Skeleton Animation & Background */
.kit-skeleton-bg {
  background: transparent !important;
  opacity: 0.65;
}

.kit-skeleton-bg :deep(.v-skeleton-loader__bone) {
  background: rgba(74, 68, 60, 0.08) !important;
  height: 100% !important;
  margin: 0 !important;
  border-radius: 4px;
}

.kit-skeleton-bg :deep(.v-skeleton-loader__bone::after) {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.25) 50%,
    rgba(255, 255, 255, 0) 100%
  ) !important;
}
</style>
