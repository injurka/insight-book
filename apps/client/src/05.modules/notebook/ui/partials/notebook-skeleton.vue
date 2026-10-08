<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'

interface Props {
  groupCount?: number
  quoteCount?: number
}

withDefaults(defineProps<Props>(), {
  groupCount: 2,
  quoteCount: 3,
})
const { t } = useI18n()
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
          <KitSkeleton
            width="52%"
            class="book-title-skeleton"
            height="1lh"
            border-radius="5px"
          />
          <KitSkeleton
            width="34%"
            class="book-author-skeleton"
            height="1lh"
            border-radius="4px"
          />
          <div class="book-stats-skeleton">
            <KitSkeleton
              class="book-badge-skeleton"
              width="96px"
              height="calc(1lh + 10px)"
              border-radius="20px"
            />
          </div>
        </div>

        <div class="book-action-skeleton">
          <KitBtn
            class="export-placeholder"
            icon="mdi:download"
            variant="tonal"
            color="secondary"
            size="sm"
            disabled
          >
            <span class="btn-text">{{ t('notebook.export') }}</span>
          </KitBtn>
          <KitSkeleton
            class="book-action-fill"
            width="100%"
            height="32px"
            border-radius="6px"
          />
        </div>
      </div>

      <div class="highlight-skeleton-list">
        <article v-for="quote in quoteCount" :key="quote" class="highlight-skeleton">
          <div class="highlight-body-skeleton">
            <div class="quote-content-skeleton">
              <div class="quote-lines-skeleton">
                <KitSkeleton width="92%" height="1.575rem" border-radius="4px" />
                <KitSkeleton
                  v-if="quote === 2"
                  width="68%"
                  height="1.575rem"
                  border-radius="4px"
                />
              </div>
              <KitSkeleton
                class="translation-skeleton"
                width="74%"
                height="1lh"
                border-radius="4px"
              />
            </div>

            <div v-if="quote === 3" class="note-skeleton">
              <KitSkeleton
                class="note-icon-skeleton"
                width="0.9rem"
                height="0.9rem"
                border-radius="4px"
              />
              <div class="note-lines-skeleton">
                <KitSkeleton width="82%" height="1lh" border-radius="4px" />
                <KitSkeleton width="58%" height="1lh" border-radius="4px" />
              </div>
            </div>
          </div>

          <div class="highlight-footer-skeleton">
            <div class="highlight-info-skeleton">
              <KitSkeleton width="72px" height="calc(1lh + 4px)" border-radius="4px" />
              <KitSkeleton width="58px" height="calc(1lh + 4px)" border-radius="4px" />
              <KitSkeleton width="78px" height="calc(1lh + 4px)" border-radius="4px" />
            </div>
            <div class="highlight-actions-skeleton">
              <KitSkeleton width="28px" height="28px" border-radius="4px" />
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
}

.book-action-skeleton {
  position: relative;
}

.export-placeholder {
  visibility: hidden;
}

.book-action-fill {
  position: absolute;
  inset: 0;
}

.book-title-skeleton {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.book-author-skeleton {
  font-size: 0.95rem;
  margin-bottom: 8px;
}

.book-stats-skeleton {
  position: relative;
  font-size: 0.75rem;
  height: 1lh;
}

.book-badge-skeleton {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
}

.highlight-skeleton-list {
  padding: 12px 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
  gap: 20px;
  align-items: start;
}

.highlight-skeleton {
  display: flex;
  margin-bottom: 12px;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-left: 4px solid rgba(var(--fg-accent-color-rgb, 201, 117, 222), 0.65);
  border-radius: 8px;
  background: rgba(var(--bg-secondary-color-rgb, 40, 44, 52), 0.6);
}

.highlight-body-skeleton,
.quote-content-skeleton,
.quote-lines-skeleton,
.note-lines-skeleton {
  display: flex;
  flex-direction: column;
}

.quote-content-skeleton {
  gap: 8px;
}

.translation-skeleton {
  font-size: 0.95rem;
}

.note-skeleton {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);
}

.note-icon-skeleton {
  flex-shrink: 0;
  margin-top: 2px;
}

.note-lines-skeleton {
  font-size: 0.9rem;
  flex: 1;
  gap: 0;
}

.highlight-footer-skeleton {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border-secondary-color);
}

.highlight-info-skeleton,
.highlight-actions-skeleton {
  display: flex;
  align-items: center;
  gap: 8px;
}

.highlight-info-skeleton {
  font-size: 0.8rem;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.highlight-actions-skeleton {
  flex-shrink: 0;
  gap: 4px;
}

@include media-down(xs) {
  .book-group-header-skeleton {
    gap: 12px;
    padding: 12px 16px;
  }

  .export-placeholder .btn-text {
    display: none;
  }

  .export-placeholder :deep(.kit-btn-icon) {
    margin-right: 0;
  }
}
</style>
