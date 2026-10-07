<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Готовность ресурсов 0..1. */
  ratio: number
}>()

const percent = computed(() => Math.round(Math.min(Math.max(props.ratio, 0), 1) * 100))
</script>

<template>
  <div class="game-loading" role="status" aria-live="polite" aria-label="Подготовка игры">
    <div class="loading-emblem" aria-hidden="true">
      <span class="emblem-ring" />
      <span class="emblem-core" />
    </div>

    <p class="loading-title">
      Раскладываем свитки
    </p>

    <div class="loading-track" aria-hidden="true">
      <div class="loading-fill" :style="{ transform: `scaleX(${percent / 100})` }" />
    </div>

    <p class="loading-hint">
      Пергамент, туши и печати — {{ percent }}%
    </p>
  </div>
</template>

<style lang="scss" scoped>
/*
 * Экран загрузки намеренно не использует ни текстур, ни игровой шрифт —
 * и то, и другое грузится в этот самый момент. Только CSS и системный шрифт,
 * поэтому оверлей появляется в первом же кадре без мигания.
 */
.game-loading {
  position: absolute;
  inset: 0;
  z-index: 300;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: #05080f;
  background-image: radial-gradient(ellipse at 50% 45%, rgba(245, 158, 11, 0.09) 0%, rgba(5, 8, 15, 0) 62%);
  color: #e2e8f0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  cursor: progress;
}

.loading-emblem {
  position: relative;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
}

.emblem-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(245, 158, 11, 0.18);
  border-top-color: #fbbf24;
  border-right-color: rgba(251, 191, 36, 0.55);
  animation: emblem-spin 1.15s linear infinite;
}

.emblem-core {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe6b6, #d97706 70%);
  box-shadow: 0 0 18px rgba(245, 158, 11, 0.55);
  animation: emblem-pulse 1.8s ease-in-out infinite;
}

.loading-title {
  margin: 4px 0 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fcd34d;
  text-shadow: 0 2px 12px rgba(245, 158, 11, 0.35);
}

.loading-track {
  position: relative;
  width: min(260px, 60vw);
  height: 6px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  overflow: hidden;
}

.loading-fill {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  transform-origin: left center;
  background: linear-gradient(90deg, #b45309, #fbbf24);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.45);
  transition: transform 0.25s ease-out;
}

.loading-hint {
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: #94a3b8;
}

@keyframes emblem-spin {
  to { transform: rotate(360deg); }
}

@keyframes emblem-pulse {
  0%, 100% { opacity: 0.65; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.05); }
}
</style>
