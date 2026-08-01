<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useScrollStudyStore } from '../../model/scroll-study.store'

const emit = defineEmits<{
  (e: 'open-scrolls'): void
}>()

const scrollStore = useScrollStudyStore()
</script>

<template>
  <div v-if="scrollStore.activeWord" class="scroll-header-container">
    <p class="header-subtitle">
      Соедините все доступные ключи потоками Ци с центральным символом
    </p>
  </div>
</template>

<style lang="scss" scoped>
.scroll-header-container {
  margin-bottom: 24px;
  text-align: center;

  .title-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 4px;

    .header-title {
      font-size: 1.85rem;
      color: #fbbf24;
      font-weight: 600;
      margin: 0;
      filter: drop-shadow(0 2px 8px rgba(245, 158, 11, 0.4));
    }

    .action-btn {
      padding: 6px 12px;
      border-radius: 8px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fcd34d;
      font-size: 0.75rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(245, 158, 11, 0.28);
        border-color: rgba(245, 158, 11, 0.5);
      }

      &:active {
        transform: scale(0.95);
      }

      &.secondary {
        background: rgba(30, 41, 59, 0.6);
        border-color: rgba(71, 85, 105, 0.6);
        color: #94a3b8;

        &:hover {
          background: rgba(51, 65, 85, 0.8);
          color: #e2e8f0;
        }
      }

      .btn-icon {
        font-size: 0.95rem;
      }
    }
  }

  .header-subtitle {
    margin: 0;
    color: #94a3b8;
    font-size: 0.85rem;
  }
}
</style>
