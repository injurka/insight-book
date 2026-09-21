<script setup lang="ts">
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'

interface Props {
  count?: number
  showTitle?: boolean
}

withDefaults(defineProps<Props>(), {
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
        <div class="cover-skeleton">
          <KitSkeleton width="100%" height="100%" border-radius="0" />
          <KitSkeleton
            class="language-skeleton"
            width="28px"
            height="18px"
            border-radius="4px"
          />
        </div>
        <div class="info-skeleton">
          <div class="title-row-skeleton">
            <div class="title-lines-skeleton">
              <KitSkeleton width="88%" height="18px" />
              <KitSkeleton width="62%" height="18px" />
            </div>
            <KitSkeleton
              class="action-skeleton"
              width="28px"
              height="28px"
              border-radius="6px"
            />
          </div>
          <KitSkeleton class="author-skeleton" width="48%" height="14px" />
          <div class="progress-skeleton">
            <KitSkeleton width="42%" height="13px" />
            <KitSkeleton width="100%" height="4px" border-radius="2px" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.skeleton-section {
  display: flex;
  flex-direction: column;
  padding-bottom: 24px;

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
  display: flex;
  flex-direction: column;
  background-color: var(--bg-secondary-color);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-secondary-color);

  .cover-skeleton {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 3;
    overflow: hidden;
    border-bottom: 1px solid var(--border-secondary-color);
    border-radius: 12px;

    .language-skeleton {
      position: absolute;
      top: 8px;
      left: 8px;
    }
  }

  .info-skeleton {
    padding: 16px;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    min-height: 128px;
  }

  .title-row-skeleton {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .title-lines-skeleton {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 5px;
    padding-top: 2px;
  }

  .action-skeleton {
    flex-shrink: 0;
    margin: -4px -8px 0 0;
  }

  .author-skeleton {
    margin-top: 8px;
  }

  .progress-skeleton {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: auto;
  }

  @include media-down(sm) {
    flex-direction: row;
    padding: 12px;
    align-items: center;

    .cover-skeleton {
      width: 80px;
      height: 120px;
      aspect-ratio: auto;
      flex-shrink: 0;
      border-bottom: none;
      border-radius: 6px;

      .language-skeleton {
        top: 4px;
        left: 4px;
        width: 24px !important;
        height: 16px !important;
      }
    }

    .info-skeleton {
      flex-grow: 1;
      align-self: stretch;
      justify-content: center;
      min-width: 0;
      min-height: 0;
      padding: 0 0 0 16px;
    }

    .title-lines-skeleton {
      gap: 4px;
    }

    .author-skeleton {
      margin-top: 7px;
    }

    .progress-skeleton {
      margin-top: auto;
    }
  }
}
</style>
