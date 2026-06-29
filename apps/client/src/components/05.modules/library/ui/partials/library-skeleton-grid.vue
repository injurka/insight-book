<script setup lang="ts">
import { KitSkeleton } from '~/components/01.kit'

withDefaults(defineProps<{ count?: number, showTitle?: boolean }>(), {
  count: 14,
  showTitle: false,
})
</script>

<template>
  <div class="skeleton-section">
    <div v-if="showTitle" class="title-skeleton">
      <KitSkeleton width="24px" height="24px" border-radius="4px" />
      <KitSkeleton width="160px" height="20px" border-radius="4px" />
    </div>
    <div class="books-grid">
      <div v-for="i in count" :key="i" class="book-card-skeleton">
        <div class="cover-skeleton" />
        <div class="info-skeleton">
          <KitSkeleton width="80%" height="18px" />
          <KitSkeleton width="50%" height="14px" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.skeleton-section {
  display: flex;
  flex-direction: column;

  .title-skeleton {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px 0;
    border-bottom: 2px solid var(--border-secondary-color);
    padding-bottom: 8px;
    height: 28px;
  }
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.book-card-skeleton {
  background-color: var(--bg-secondary-color);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);

  .cover-skeleton {
    width: 100%;
    aspect-ratio: 2 / 3;
    background-color: var(--bg-tertiary-color);
  }
  .info-skeleton {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  @include media-down(sm) {
    display: flex;
    flex-direction: row;
    height: 120px;
    padding: 12px;
    align-items: center;

    .cover-skeleton {
      width: 72px;
      height: 108px;
      flex-shrink: 0;
      border-radius: 6px;
    }
    .info-skeleton {
      flex-grow: 1;
      justify-content: center;
    }
  }
}
</style>
