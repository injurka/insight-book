<script setup lang="ts">
import AutoAnalyzeCard from './ai/auto-analyze-card.vue'
import CustomLlmCard from './ai/custom-llm-card.vue'
</script>

<template>
  <div class="settings-ai-panel">
    <CustomLlmCard />
    <AutoAnalyzeCard />
  </div>
</template>

<style lang="scss" scoped>
.settings-ai-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
