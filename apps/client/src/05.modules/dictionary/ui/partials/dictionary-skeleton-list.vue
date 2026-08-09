<script setup lang="ts">
import { KitSkeleton } from '~/02.kit'

interface Props {
  viewMode: 'list' | 'grid'
  count?: number
}

withDefaults(defineProps<Props>(), {
  count: 6,
})
</script>

<template>
  <div class="skeleton-container">
    <div v-if="viewMode === 'grid'" class="dict-grid-skeleton">
      <div v-for="i in (count + 2)" :key="i" class="dict-item-skeleton is-grid">
        <div class="dict-item-content">
          <div class="dict-word-container">
            <div class="word-group">
              <KitSkeleton width="110px" height="22px" border-radius="4px" />
              <KitSkeleton width="50px" height="16px" border-radius="4px" />
            </div>
          </div>
          <div class="skeleton-lines">
            <KitSkeleton width="90%" height="15px" border-radius="4px" />
            <KitSkeleton width="60%" height="15px" border-radius="4px" />
          </div>
        </div>
      </div>
    </div>
    <div v-else class="dict-list-skeleton">
      <div v-for="i in count" :key="i" class="dict-item-skeleton">
        <div class="dict-item-content">
          <div class="dict-word-container">
            <div class="word-group">
              <KitSkeleton width="130px" height="22px" border-radius="4px" />
              <KitSkeleton width="70px" height="16px" border-radius="4px" />
            </div>
            <div class="badges-group">
              <KitSkeleton width="45px" height="18px" border-radius="4px" />
              <KitSkeleton width="55px" height="18px" border-radius="4px" />
            </div>
          </div>
          <div class="skeleton-lines">
            <KitSkeleton width="80%" height="15px" border-radius="4px" />
            <KitSkeleton width="50%" height="15px" border-radius="4px" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.skeleton-container {
  flex-grow: 1;
  min-height: 0;
  overflow: hidden;
}

.dict-grid-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
}

.dict-list-skeleton {
  display: flex;
  flex-direction: column;
}

.dict-item-skeleton {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  border: 1px solid var(--border-secondary-color);
  margin-bottom: 12px;

  .dict-item-content {
    flex-grow: 1;
    min-width: 0;
  }

  .dict-word-container {
    margin-bottom: 8px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;

    .word-group {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badges-group {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
  }

  .skeleton-lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &.is-grid {
    flex-direction: column;
    align-items: stretch;
    margin-bottom: 0;
    min-height: 120px;
  }
}
</style>
