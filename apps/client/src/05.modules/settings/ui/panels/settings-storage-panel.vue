<script setup lang="ts">
import StorageOverviewCard from './storage/storage-overview-card.vue'
</script>

<template>
  <div class="settings-storage-panel">
    <StorageOverviewCard />
  </div>
</template>

<style lang="scss" scoped>
.settings-storage-panel {
  display: flex;
  flex-direction: column;
}
</style>
