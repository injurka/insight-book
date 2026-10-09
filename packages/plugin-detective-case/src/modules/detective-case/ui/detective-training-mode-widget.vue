<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function startDetectiveCase(): void {
  void router.push({ name: 'plugin-detective-case-index' })
}
</script>

<template>
  <button type="button" class="detective-mode-card" @click="startDetectiveCase">
    <Icon icon="mdi:magnify" class="mode-icon" />
    <span class="mode-title">Detective English</span>
    <span class="mode-desc">Раскройте дело, повторяя слова из очереди SRS</span>
  </button>
</template>

<style scoped>
.detective-mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 1px solid rgba(216, 166, 94, 0.42);
  border-radius: 12px;
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font: inherit;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.detective-mode-card:hover,
.detective-mode-card:focus-visible {
  border-color: #d8a65e;
  background: color-mix(in srgb, #d8a65e 8%, var(--bg-primary-color));
  box-shadow: 0 8px 24px rgba(216, 166, 94, 0.12);
}

.detective-mode-card:focus-visible {
  outline: 2px solid #d8a65e;
  outline-offset: 2px;
}

.mode-icon {
  color: #d8a65e;
  font-size: 2rem;
}

.mode-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.mode-desc {
  color: var(--fg-muted-color);
  font-size: 0.75rem;
  line-height: 1.3;
}
</style>
