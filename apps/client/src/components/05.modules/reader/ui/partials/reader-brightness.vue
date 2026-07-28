<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useReaderBrightnessGesture } from '../../composables/use-reader-brightness-gesture'

const settingsStore = useGlobalSettingsStore()
const { showHud, isSwiping } = useReaderBrightnessGesture()

const brightnessPercentage = computed(() => Math.round((settingsStore.readerBrightness ?? 1) * 100))

const brightnessIcon = computed(() => {
  const val = settingsStore.readerBrightness ?? 1
  if (val > 0.7)
    return 'mdi:brightness-7'
  if (val > 0.4)
    return 'mdi:brightness-5'
  return 'mdi:brightness-4'
})
</script>

<template>
  <div class="reader-brightness-container">
    <div
      class="reader-brightness-overlay"
      :style="{ opacity: 1 - (settingsStore.readerBrightness ?? 1) }"
    />

    <Transition name="fade-hud">
      <div v-if="showHud" class="reader-brightness-hud" :class="{ 'is-active': isSwiping }">
        <Icon :icon="brightnessIcon" class="hud-icon" />
        <div class="hud-bar-container">
          <div class="hud-bar-fill" :style="{ height: `${brightnessPercentage}%` }" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.reader-brightness-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 998;
}

.reader-brightness-overlay {
  position: fixed;
  inset: 0;
  background-color: #000000;
  pointer-events: none;
  z-index: 998;
  transition: opacity 0.05s linear;
}

.reader-brightness-hud {
  position: fixed;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 10px;
  background-color: var(--bg-secondary-color);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-secondary-color);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  color: var(--fg-primary-color);
  user-select: none;
  pointer-events: none;
  transition:
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.reader-brightness-hud.is-active {
  transform: translateY(-50%) scale(1.06);
  border-color: var(--fg-accent-color);
}

.hud-icon {
  font-size: 1.4rem;
  color: var(--fg-accent-color);
  transition: color 0.2s ease;
}

.hud-bar-container {
  width: 6px;
  height: 96px;
  background-color: var(--bg-tertiary-color);
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.hud-bar-fill {
  width: 100%;
  background-color: var(--fg-accent-color);
  border-radius: 3px;
  transition: height 0.08s ease-out;
  box-shadow: 0 0 8px var(--fg-accent-color);
}

.fade-hud-enter-active,
.fade-hud-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.fade-hud-enter-from,
.fade-hud-leave-to {
  opacity: 0;
  transform: translateY(-50%) scale(0.9);
}
</style>
