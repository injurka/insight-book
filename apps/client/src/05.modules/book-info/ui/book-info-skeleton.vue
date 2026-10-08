<script setup lang="ts">
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'

const placeholder = { color: 'color-mix(in srgb, var(--fg-secondary-color) 12%, var(--bg-primary-color))' }
</script>

<template>
  <div class="book-info-skeleton" aria-hidden="true">
    <div class="skeleton-top">
      <div class="skeleton-cover-column">
        <div class="skeleton-cover">
          <KitSkeleton v-bind="placeholder" height="100%" border-radius="12px" />
        </div>
        <div class="skeleton-actions">
          <KitSkeleton
            v-bind="placeholder"
            class="skeleton-read"
            height="38px"
            border-radius="6px"
          />
          <KitSkeleton
            v-bind="placeholder"
            class="skeleton-cache"
            height="38px"
            border-radius="6px"
          />
        </div>
      </div>
      <div class="skeleton-details">
        <div class="skeleton-heading">
          <KitSkeleton v-bind="placeholder" width="78%" height="32px" />
          <KitSkeleton v-bind="placeholder" width="36%" height="18px" />
        </div>
        <div class="skeleton-progress">
          <div class="skeleton-progress-header">
            <KitSkeleton v-bind="placeholder" width="58%" height="16px" />
            <KitSkeleton
              v-bind="placeholder"
              width="20px"
              height="20px"
              border-radius="50%"
            />
          </div>
          <KitSkeleton v-bind="placeholder" height="6px" border-radius="99px" />
        </div>
        <div class="skeleton-overview">
          <div class="skeleton-overview-header">
            <KitSkeleton v-bind="placeholder" width="48%" height="20px" />
            <div class="skeleton-tools">
              <KitSkeleton
                v-for="item in 2"
                :key="item"
                v-bind="placeholder"
                width="20px"
                height="20px"
                border-radius="50%"
              />
            </div>
          </div>
          <div class="skeleton-tags">
            <KitSkeleton
              v-bind="placeholder"
              width="38%"
              height="24px"
              border-radius="6px"
            />
            <KitSkeleton
              v-bind="placeholder"
              width="26%"
              height="24px"
              border-radius="6px"
            />
            <KitSkeleton
              v-bind="placeholder"
              width="20%"
              height="24px"
              border-radius="6px"
            />
          </div>
          <div class="skeleton-description">
            <KitSkeleton v-bind="placeholder" height="14px" />
            <KitSkeleton v-bind="placeholder" width="94%" height="14px" />
            <KitSkeleton v-bind="placeholder" width="66%" height="14px" />
          </div>
          <div class="skeleton-stats">
            <div v-for="item in 3" :key="item" class="skeleton-stat">
              <KitSkeleton v-bind="placeholder" width="80%" height="12px" />
              <KitSkeleton
                v-bind="placeholder"
                :width="item === 1 ? '38px' : '70%'"
                height="24px"
                border-radius="6px"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="skeleton-lexical">
      <KitSkeleton v-bind="placeholder" width="38%" height="20px" />
      <KitSkeleton
        v-bind="placeholder"
        width="16px"
        height="16px"
        border-radius="50%"
      />
    </div>
    <div class="skeleton-toc">
      <KitSkeleton v-bind="placeholder" width="180px" height="26px" />
      <div v-for="(width, index) in ['44%', '62%', '36%', '52%']" :key="index" class="skeleton-toc-row">
        <KitSkeleton v-bind="placeholder" :width="width" height="14px" />
        <KitSkeleton v-bind="placeholder" width="24px" height="14px" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.book-info-skeleton :deep(.kit-skeleton--wave::after) {
  display: none;
}
.skeleton-top {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 40px;
  margin-bottom: 32px;
}
.skeleton-cover-column,
.skeleton-details {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.skeleton-cover {
  aspect-ratio: 2 / 3;
  margin-bottom: 24px;
}
.skeleton-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
}
.skeleton-heading {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 5px 0;
  margin-bottom: 24px;
}
.skeleton-progress {
  padding: 16px;
  margin-bottom: 24px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
}
.skeleton-progress-header,
.skeleton-overview-header,
.skeleton-lexical {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.skeleton-progress-header {
  margin-bottom: 8px;
}
.skeleton-overview {
  flex: 1;
  padding: 24px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 16px;
  background: var(--bg-secondary-color);
}
.skeleton-overview-header {
  min-height: 32px;
  margin-bottom: 16px;
}
.skeleton-tools,
.skeleton-tags {
  display: flex;
  gap: 8px;
}
.skeleton-tools {
  flex-shrink: 0;
}
.skeleton-tags {
  margin-bottom: 20px;
}
.skeleton-description {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 7px 0;
}
.skeleton-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-secondary-color);
}
.skeleton-stat {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skeleton-lexical {
  padding: 20px 24px;
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  background: var(--bg-secondary-color);
  margin-bottom: 32px;
}
.skeleton-toc > .kit-skeleton {
  margin: 16px 0 20px;
}
.skeleton-toc-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 8px;
  border-top: 1px solid var(--border-secondary-color);
}
@include media-down(md) {
  .skeleton-top {
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
  .skeleton-actions {
    flex-direction: row;
    gap: 8px;
  }
  .skeleton-read {
    flex: 1;
    width: auto !important;
  }
  .skeleton-cache {
    width: 38px !important;
    flex-shrink: 0;
  }
}
@include media-down(sm) {
  .skeleton-overview {
    padding: 16px;
  }
  .skeleton-stats {
    gap: 10px;
  }
  .skeleton-lexical {
    padding: 16px;
  }
}
</style>
