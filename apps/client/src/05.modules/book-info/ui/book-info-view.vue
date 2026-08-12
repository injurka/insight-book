<script setup lang="ts">
import { useHead } from '@vueuse/head'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg/ui'
import { KitSkeleton } from '~/02.kit/atoms/kit-skeleton/ui'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import BookCoverPanel from './book-cover-panel.vue'
import BookLexicalPanel from './book-lexical-panel.vue'
import BookStatsPanel from './book-stats-panel.vue'
import BookTocPanel from './book-toc-panel.vue'

const SelectionTooltip = lazyComponent(() => import('~/04.features/analysis/ui/selection-tooltip.vue'))
const SentenceAnalysis = lazyComponent(() => import('~/04.features/analysis/ui/sentence-analysis.vue'))
const WordPopover = lazyComponent(() => import('~/04.features/analysis/ui/popover/word-popover.vue'))
const AppendMangaModal = lazyComponent(() => import('./modal/append-manga-modal.vue'))
const BookSyncModal = lazyComponent(() => import('./modal/book-sync-modal.vue'))

const route = useRoute()
const router = useRouter()
const libraryStore = useLibraryStore()
const { t } = useI18n()

useHead({
  title: computed(() => libraryStore.currentBookInfo?.title || t('bookInfo.aboutBook')),
})

const bookId = computed(() => Number(route.params.id))
const isEditingStats = ref(false)
const isSyncModalOpen = ref(false)
const isAppendChapterOpen = ref(false)

// Стор префиллит currentBookInfo книгой из списка библиотеки, поэтому реальная
// структура (обложка, название, автор, кнопки) рендерится с первого кадра,
// а скелетон-оверлей плавно растворяется, когда API ответит.
watch(bookId, (newId) => {
  if (newId)
    libraryStore.fetchBookInfo(newId)
}, { immediate: true })

function goBack() {
  router.push(AppRoutePaths.Home)
}
</script>

<template>
  <div class="book-info-scroll-wrapper">
    <KitHoverRevealBg />

    <div class="book-info-page">
      <header class="page-header">
        <KitBtn icon="mdi:arrow-left" variant="text" @click="goBack" />
        <span class="header-title">{{ t('bookInfo.aboutBook') }}</span>
      </header>

      <!-- Реальная структура рендерится с первого кадра: обложка, название и автор
           приходят оптимистично из списка библиотеки (префилл в сторе), пока API
           отвечает. Скелетоны — отдельный оверлей поверх; он плавно растворяется,
           когда данные загружены, поэтому нет подмены DOM, моргания и сдвига скролла -->
      <div v-if="libraryStore.isLoading || libraryStore.currentBookInfo" class="book-container">
        <div class="layout-top">
          <BookCoverPanel
            @edit-stats="isEditingStats = true"
            @open-sync="isSyncModalOpen = true"
            @open-append-chapter="isAppendChapterOpen = true"
          />
          <div class="content-col">
            <BookStatsPanel v-model:is-editing="isEditingStats" />
          </div>
        </div>
        <div class="layout-bottom">
          <BookLexicalPanel v-if="libraryStore.currentBookInfo?.type !== 'manga'" />
          <BookTocPanel />
        </div>

        <Transition name="skeleton-fade">
          <div v-if="!libraryStore.hasLoadedBookInfo" class="skeleton-overlay" aria-hidden="true">
            <div class="layout-top">
              <!-- Без префилла (глубокая ссылка) — скелетоны и для обложки с кнопками;
                   с префиллом колонка прозрачная: реальная обложка уже под оверлеем -->
              <div class="cover-col">
                <template v-if="!libraryStore.currentBookInfo">
                  <div class="cover-skeleton">
                    <KitSkeleton width="100%" height="100%" border-radius="12px" />
                  </div>
                  <div class="action-buttons">
                    <KitSkeleton width="100%" height="38px" border-radius="6px" />
                    <KitSkeleton width="100%" height="38px" border-radius="6px" />
                  </div>
                </template>
                <template v-else>
                  <!-- Невидимые распорки повторяют высоты реальной обложки и кнопок,
                       чтобы нижние скелетоны встали ровно на место будущих панелей -->
                  <div class="cover-space" />
                  <div class="actions-space" />
                </template>
              </div>
              <div class="content-col">
                <template v-if="!libraryStore.currentBookInfo">
                  <KitSkeleton
                    width="80%"
                    height="40px"
                    class="title-skeleton"
                    border-radius="8px"
                  />
                  <KitSkeleton
                    width="40%"
                    height="24px"
                    class="author-skeleton"
                    border-radius="6px"
                  />
                  <KitSkeleton
                    width="100%"
                    height="72px"
                    class="progress-skeleton"
                    border-radius="12px"
                  />
                </template>
                <template v-else>
                  <!-- Прозрачные распорки повторяют высоты реальных заголовка/автора/прогресса,
                       чтобы скелетон статистики встал ровно на место будущего блока -->
                  <div class="title-space" />
                  <div class="author-space" />
                  <div class="progress-space" />
                </template>
                <div class="skeleton-block stats-block">
                  <KitSkeleton width="100%" height="100%" border-radius="12px" />
                </div>
              </div>
            </div>
            <div class="layout-bottom">
              <div class="skeleton-block bottom-block">
                <KitSkeleton width="100%" height="100%" border-radius="12px" />
              </div>
              <div class="skeleton-block bottom-block toc-block">
                <KitSkeleton width="100%" height="100%" border-radius="12px" />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
    <BookSyncModal v-if="libraryStore.currentBookInfo" v-model:visible="isSyncModalOpen" :book-id="bookId" />
    <AppendMangaModal v-model:visible="isAppendChapterOpen" />
  </div>
</template>

<style lang="scss" scoped>
.book-info-scroll-wrapper {
  padding-top: var(--safe-area-top);

  height: 100%;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: var(--border-secondary-color);
    border-radius: 4px;
  }
}

.book-info-page {
  position: relative;
  z-index: 1;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  min-height: 100%;
  padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 24px);

  @include media-down(md) {
    padding: 16px 8px;
  }
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  .header-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
  }
}

.layout-top {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 40px;
  margin-bottom: 32px;

  @include media-down(md) {
    grid-template-columns: 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
}

.layout-bottom {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.book-container {
  position: relative;
}

.skeleton-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
  pointer-events: none;
}

.skeleton-block {
  background-color: var(--bg-primary-color);
  border-radius: 12px;
  overflow: hidden;
}

.stats-block {
  height: 240px;
}

.bottom-block {
  height: 300px;
}

.toc-block {
  height: 180px;
}

.title-space {
  height: 42px;
  margin-bottom: 8px;
}

.author-space {
  height: 25px;
  margin-bottom: 24px;
}

.progress-space {
  height: 70px;
  margin-bottom: 24px;
}

.cover-space {
  aspect-ratio: 2 / 3;
  margin-bottom: 24px;
}

.actions-space {
  height: 132px;
}

.skeleton-fade-enter-active,
.skeleton-fade-leave-active {
  transition: opacity 0.3s ease;
}

.skeleton-fade-enter-from,
.skeleton-fade-leave-to {
  opacity: 0;
}

.cover-skeleton {
  aspect-ratio: 2 / 3;
  margin-bottom: 24px;
  border-radius: 12px;
  overflow: hidden;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.title-skeleton {
  margin-bottom: 8px;
}

.author-skeleton {
  margin-bottom: 24px;
}

.progress-skeleton {
  margin-bottom: 24px;
}

.content-col {
  min-width: 0;
}
</style>
