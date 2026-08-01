<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'

const router = useRouter()

function startScrollStudy() {
  router?.push({ name: 'plugin-scroll-study-index' })
}
</script>

<template>
  <div class="mode-card scroll-training-widget" @click="startScrollStudy">
    <Icon icon="mdi:scroll-text-outline" class="mode-icon" />
    <span class="mode-title">Изучение свитков</span>
    <span class="mode-desc">Соединяйте стихийные ключи и иероглифы на магической hex-доске</span>
  </div>
</template>

<style lang="scss" scoped>
.scroll-training-widget {
  /* Replicate base mode-card layout rules to handle Vue scoped stylesheet boundary */
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;

  /* Custom Amber/Gold styling overrides */
  border-color: rgba(245, 158, 11, 0.3) !important;

  &:hover {
    border-color: #fbbf24 !important;
    background: rgba(245, 158, 11, 0.05) !important;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(245, 158, 11, 0.1) !important;

    .mode-icon {
      color: #fbbf24 !important;
    }
  }

  .mode-icon {
    font-size: 2rem;
    color: #fcd34d !important;
    transition: color 0.2s ease;
  }

  .mode-title {
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--fg-primary-color);
  }

  .mode-desc {
    font-size: 0.75rem;
    color: var(--fg-muted-color);
    line-height: 1.3;
  }
}
</style>
