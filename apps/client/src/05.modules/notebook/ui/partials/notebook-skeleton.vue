<script setup lang="ts">
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'

interface Props {
  groupCount?: number
  quoteCount?: number
}

withDefaults(defineProps<Props>(), {
  groupCount: 2,
  quoteCount: 3,
})
</script>

<template>
  <div class="notebook-skeleton" aria-hidden="true">
    <section v-for="group in groupCount" :key="group" class="notebook-skeleton-group">
      <div class="book-group-header-skeleton">
        <KitSkeleton
          class="book-cover-skeleton"
          width="48px"
          height="72px"
          border-radius="6px"
        />

        <div class="book-metadata-skeleton">
          <KitSkeleton width="52%" height="22px" border-radius="5px" />
          <KitSkeleton width="34%" height="15px" border-radius="4px" />
          <KitSkeleton
            class="book-badge-skeleton"
            width="96px"
            height="24px"
            border-radius="20px"
          />
        </div>

        <KitSkeleton
          class="book-action-skeleton"
          width="112px"
          height="40px"
          border-radius="8px"
        />
      </div>

      <div class="highlight-skeleton-list">
        <article v-for="quote in quoteCount" :key="quote" class="highlight-skeleton">
          <div class="highlight-body-skeleton">
            <div class="quote-content-skeleton">
              <KitSkeleton width="92%" height="19px" border-radius="4px" />
              <KitSkeleton width="68%" height="19px" border-radius="4px" />
              <KitSkeleton
                class="translation-skeleton"
                width="74%"
                height="16px"
                border-radius="4px"
              />
            </div>

            <div v-if="quote === 1" class="note-skeleton">
              <KitSkeleton width="18px" height="18px" border-radius="4px" />
              <div class="note-lines-skeleton">
                <KitSkeleton width="82%" height="14px" border-radius="4px" />
                <KitSkeleton width="58%" height="14px" border-radius="4px" />
              </div>
            </div>
          </div>

          <div class="highlight-footer-skeleton">
            <div class="highlight-info-skeleton">
              <KitSkeleton width="72px" height="22px" border-radius="6px" />
              <KitSkeleton width="58px" height="22px" border-radius="6px" />
              <KitSkeleton width="78px" height="22px" border-radius="6px" />
            </div>
            <div class="highlight-actions-skeleton">
              <KitSkeleton width="24px" height="24px" border-radius="6px" />
              <KitSkeleton width="24px" height="24px" border-radius="6px" />
              <KitSkeleton width="24px" height="24px" border-radius="6px" />
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.notebook-skeleton {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.notebook-skeleton-group {
  display: flex;
  flex-direction: column;
}

.book-group-header-skeleton {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
  padding: 16px 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  background: rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.65);
}

.book-cover-skeleton,
.book-action-skeleton {
  flex-shrink: 0;
}

.book-metadata-skeleton {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.book-badge-skeleton {
  margin-top: 2px;
}

.highlight-skeleton-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  align-items: start;
}

.highlight-skeleton {
  display: flex;
  min-height: 188px;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-left: 4px solid rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0.65);
  border-radius: 16px;
  background: rgba(var(--bg-secondary-color-rgb, 40, 44, 52), 0.6);
}

.highlight-body-skeleton,
.quote-content-skeleton,
.note-lines-skeleton {
  display: flex;
  flex-direction: column;
}

.highlight-body-skeleton {
  gap: 16px;
}

.quote-content-skeleton {
  gap: 7px;
}

.translation-skeleton {
  margin-top: 5px;
}

.note-skeleton {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  background: rgba(var(--bg-primary-color-rgb, 24, 24, 27), 0.5);
}

.note-lines-skeleton {
  flex: 1;
  gap: 6px;
  padding-top: 2px;
}

.highlight-footer-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.highlight-info-skeleton,
.highlight-actions-skeleton {
  display: flex;
  align-items: center;
  gap: 8px;
}

.highlight-actions-skeleton {
  gap: 4px;
}

@include media-down(xs) {
  .book-group-header-skeleton {
    gap: 12px;
    padding: 12px 16px;
  }

  .book-action-skeleton {
    width: 40px !important;
  }

  .highlight-skeleton-list {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .highlight-skeleton {
    min-height: 0;
  }

  .highlight-footer-skeleton {
    align-items: flex-end;
  }

  .highlight-info-skeleton {
    flex-wrap: wrap;
  }
}
</style>
