<script setup lang="ts">
import AppearanceCard from './interface/appearance-card.vue'
import PushSettingsCard from './interface/push-settings-card.vue'
import TtsSettingsCard from './interface/tts-settings-card.vue'
import TypographyCard from './interface/typography-card.vue'
</script>

<template>
  <div class="settings-interface-panel">
    <AppearanceCard />
    <TypographyCard />
    <TtsSettingsCard />
    <PushSettingsCard />
  </div>
</template>

<style lang="scss" scoped>
.settings-interface-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>
