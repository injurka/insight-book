<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppWakeLock } from '~/01.shared/composables/use-app-wake-lock'
import { useDelayedLoading } from '~/01.shared/composables/use-delayed-loading'
import { useToast } from '~/01.shared/composables/use-toast'
import { lazyComponent } from '~/01.shared/lib/lazy-component'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useNetworkStore } from '~/01.shared/store/network.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'
import { useTextSelection } from '~/04.features/analysis'
import { useParallelSync } from '../composables/use-parallel-sync'
import { useQuoteHighlights } from '../composables/use-quote-highlights'
import { useReaderContent } from '../composables/use-reader-content'
import { useReaderContinuous } from '../composables/use-reader-continuous'
import { useReaderDomHighlights } from '../composables/use-reader-dom-highlights'
import { useReaderHotkeys } from '../composables/use-reader-hotkeys'
import { useReaderNavigation } from '../composables/use-reader-navigation'
import { useReaderScroll } from '../composables/use-reader-scroll'
import { useReadingSession } from '../composables/use-reading-session'
import { useScrollRestoration } from '../composables/use-scroll-restoration'
import { useReaderStore } from '../store/reader.store'

import ReaderTocDialog from './dialog/reader-toc-dialog.vue'
import ReaderFooter from './partials/reader-footer.vue'
import ReaderHeader from './partials/reader-header.vue'
import ReaderLoader from './partials/reader-loader.vue'
import ReaderPageBlock from './partials/reader-page-block.vue'

const PageAnalysisModal = lazyComponent(() => import('~/04.features/analysis/ui/modal/page-analysis-modal.vue'))
const SelectionTooltip = lazyComponent(() => import('~/04.features/analysis/ui/selection-tooltip.vue'))
const SentenceAnalysis = lazyComponent(() => import('~/04.features/analysis/ui/sentence-analysis.vue'))
const WordPopover = lazyComponent(() => import('~/04.features/analysis/ui/popover/word-popover.vue'))
const GrammarPopover = lazyComponent(() => import('~/04.features/analysis/ui/popover/grammar-popover.vue'))

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const networkStore = useNetworkStore()
const toast = useToast()
const { t } = useI18n()
const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')
const topSentinelRef = useTemplateRef<HTMLElement>('topSentinelRef')
const bottomSentinelRef = useTemplateRef<HTMLElement>('bottomSentinelRef')

useAppWakeLock(() => analysisStore.isManualPageAnalysisActive || analysisStore.isAutoPageAnalysisActive)
useReadingSession()

const showSpinner = useDelayedLoading(computed(() => readerStore.isPageLoading), 1000)
const totalPages = computed(() => readerStore.currentBook?.totalPages ?? 0)

const {
  isRestoringScroll,
  saveScrollPosition,
  restoreScrollPosition,
  setScrollIntent,
} = useScrollRestoration(
  readerViewRef,
  () => readerStore.currentBook?.id,
  () => readerStore.currentPage?.pageNum,
  () => readerStore.isPageLoading,
)

const { onSentenceHover, onSentenceOut } = useReaderDomHighlights(readerViewRef)
const { prevPage, nextPage, goToPage } = useReaderNavigation(setScrollIntent)
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()

const {
  continuousPages,
  isLoadingNext,
  isLoadingPrev,
  activePageNum,
  jumpToPage: jumpToPageContinuous,
} = useReaderContinuous(readerViewRef, topSentinelRef, bottomSentinelRef)

async function handlePrev() {
  if (settingsStore.readerScrollMode === 'continuous') {
    if (activePageNum.value > 1 && readerStore.currentBook) {
      await jumpToPageContinuous(readerStore.currentBook.id, activePageNum.value - 1)
    }
  }
  else {
    await prevPage()
  }
}

async function handleNext() {
  if (settingsStore.readerScrollMode === 'continuous') {
    if (readerStore.currentBook && activePageNum.value < readerStore.currentBook.totalPages) {
      await jumpToPageContinuous(readerStore.currentBook.id, activePageNum.value + 1)
    }
  }
  else {
    await nextPage()
  }
}

async function handleGoTo(pageNum?: number) {
  if (!pageNum || !readerStore.currentBook)
    return

  readerStore.tocOpen = false

  if (settingsStore.readerScrollMode === 'continuous') {
    await jumpToPageContinuous(readerStore.currentBook.id, pageNum)
  }
  else {
    await goToPage(pageNum)
  }
}

useReaderHotkeys(handlePrev, handleNext)

function savePaginatedScrollPosition() {
  if (settingsStore.readerScrollMode === 'paginated')
    saveScrollPosition()
}

const { isHeaderVisible, onScroll } = useReaderScroll(savePaginatedScrollPosition, undefined, isRestoringScroll)
const { performLayoutSync, syncLayout } = useParallelSync(readerViewRef, restoreScrollPosition)
const { leftPaneContent, translatedPageContent, pageTranslationProgress } = useReaderContent()
useQuoteHighlights(readerViewRef, [leftPaneContent, translatedPageContent])

function startPageTranslationOnly(pageNum?: number) {
  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  if (pageNum && pageNum !== readerStore.currentPage?.pageNum) {
    const targetPage = continuousPages.value.find(p => p.pageNum === pageNum)
    if (targetPage) {
      readerStore.currentPage = targetPage
      readerStore.targetPageNum = pageNum
    }
  }

  analysisStore.analyzeWholePage({
    sentences: true,
    words: false,
    ttsSentences: false,
    ttsWords: false,
  }, true)
}

function startPageAnalysis() {
  if (networkStore.effectiveOffline) {
    toast.warn(t('network.needOnline'))

    return
  }

  analysisStore.isPageAnalysisSetupModalOpen = false

  if (analysisStore.isManualPageAnalysisActive) {
    analysisStore.isPageAnalysisModalOpen = true
  }
  else {
    analysisStore.analyzeWholePage({
      sentences: analysisStore.pageActionOpts.sentences,
      words: analysisStore.pageActionOpts.words,
      ttsSentences: analysisStore.pageActionOpts.ttsSentences,
      ttsWords: analysisStore.pageActionOpts.ttsWords,
    }, false)
  }
}

const rightPaneContentForSync = computed(() => {
  return pageTranslationProgress.value.isFullyTranslated ? translatedPageContent.value : leftPaneContent.value
})

async function applyCodeHighlighting() {
  if (!readerViewRef.value || !readerViewRef.value.querySelector('pre, code'))
    return

  const { highlightCodeBlocks } = await import('~/01.shared/lib/code-highlighter')
  const themeAttr = document.documentElement.getAttribute('data-theme')
  const isDark = themeAttr === 'dark' || themeAttr === 'oled'

  await highlightCodeBlocks(readerViewRef.value, isDark)
}

watch([
  () => readerStore.currentPage,
  () => settingsStore.readerScrollMode,
], ([newPage, mode]) => {
  if (mode === 'continuous' && newPage) {
    if (continuousPages.value.length === 0 || !continuousPages.value.some(p => p.pageNum === newPage.pageNum)) {
      continuousPages.value = [newPage]
      activePageNum.value = newPage.pageNum
    }
  }
}, { immediate: true })

watch([
  () => readerStore.isParallelView,
  () => settingsStore.readerFontSize,
  () => settingsStore.readerLineHeight,
  rightPaneContentForSync,
], async () => {
  if (readerStore.isPageLoading)
    return

  await nextTick()
  await applyCodeHighlighting()

  setTimeout(() => {
    if (settingsStore.readerScrollMode === 'continuous')
      syncLayout()
    else
      performLayoutSync()
  }, 50)
})

watch(continuousPages, async () => {
  await nextTick()
  await applyCodeHighlighting()
  setTimeout(syncLayout, 50)
})

watch(() => readerStore.isPageLoading, async (isLoading) => {
  if (isLoading && readerViewRef.value) {
    readerViewRef.value.scrollTop = 0
  }

  if (!isLoading && readerStore.currentPage) {
    await nextTick()
    await applyCodeHighlighting()
    setTimeout(() => {
      if (settingsStore.readerScrollMode === 'continuous')
        syncLayout()
      else
        performLayoutSync()
    }, 50)
  }
}, { immediate: true })
</script>

<template>
  <div ref="readerViewRef" class="reader-view" @scroll.passive="onScroll">
    <ReaderHeader :is-visible="isHeaderVisible" />

    <div class="reader-content-wrapper">
      <ReaderLoader :show="showSpinner" />

      <Transition name="fade-in-only">
        <div
          v-if="!readerStore.isPageLoading && readerStore.currentPage"
          :key="settingsStore.readerScrollMode === 'paginated' ? readerStore.currentPage.pageNum : 'continuous'"
          class="reader-layout-wrapper"
          :class="{ 'is-continuous': settingsStore.readerScrollMode === 'continuous' }"
        >
          <!-- Paginated Mode -->
          <template v-if="settingsStore.readerScrollMode === 'paginated'">
            <ReaderPageBlock
              :page="readerStore.currentPage"
              :is-parallel-view="readerStore.isParallelView"
              :show-page-divider="false"
              @word-click="onWordClick"
              @pointer-down="onPointerDown"
              @pointer-up="onPointerUp"
              @sentence-hover="onSentenceHover"
              @sentence-out="onSentenceOut"
              @translate-page="startPageTranslationOnly"
            />
          </template>

          <!-- Continuous Scroll Mode -->
          <template v-else>
            <div class="reader-continuous-container">
              <div ref="topSentinelRef" class="scroll-sentinel top-sentinel">
                <div v-if="isLoadingPrev" class="continuous-loading">
                  <Icon icon="mdi:loading" class="spin-icon" />
                  <span>{{ t('reader.loadingPrevPage') }}</span>
                </div>
              </div>

              <ReaderPageBlock
                v-for="page in continuousPages"
                :key="page.pageNum"
                :page="page"
                :is-parallel-view="readerStore.isParallelView"
                :show-page-divider="true"
                :total-pages="totalPages"
                @word-click="onWordClick"
                @pointer-down="onPointerDown"
                @pointer-up="onPointerUp"
                @sentence-hover="onSentenceHover"
                @sentence-out="onSentenceOut"
                @translate-page="startPageTranslationOnly"
              />

              <div ref="bottomSentinelRef" class="scroll-sentinel bottom-sentinel">
                <div v-if="isLoadingNext" class="continuous-loading">
                  <Icon icon="mdi:loading" class="spin-icon" />
                  <span>{{ t('reader.loadingNextPage') }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </Transition>
    </div>

    <GrammarPopover />

    <KitDialog
      v-model:visible="analysisStore.isPageAnalysisSetupModalOpen"
      :title="t('reader.analyzePage')"
      :max-width="400"
      :minimizable="false"
      icon="mdi:robot-outline"
    >
      <div class="analysis-setup-content">
        <div class="settings-group has-divider">
          <div class="group-header">
            <Icon icon="mdi:text-search" class="item-icon" /> {{ t('reader.textAnalysis') }}
          </div>
          <KitCheckbox v-model="analysisStore.pageActionOpts.sentences" :label="t('bookInfo.sentences')" />
          <KitCheckbox v-model="analysisStore.pageActionOpts.words" :label="t('analysis.words')" />
        </div>

        <div class="settings-group">
          <div class="group-header">
            <Icon icon="mdi:headphones" class="item-icon" /> {{ t('reader.voiceTts') }}
          </div>
          <KitCheckbox v-model="analysisStore.pageActionOpts.ttsSentences" :label="t('bookInfo.sentences')" />
          <KitCheckbox v-model="analysisStore.pageActionOpts.ttsWords" :label="t('analysis.words')" />
        </div>

        <KitBtn
          class="start-btn"
          color="primary"
          @click="startPageAnalysis"
        >
          <Icon icon="mdi:play" class="btn-icon" />
          {{ t('reader.startAnalysis') }}
        </KitBtn>
      </div>
    </KitDialog>

    <ReaderTocDialog @go-to="handleGoTo" />
    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
    <PageAnalysisModal />

    <ReaderFooter @prev="handlePrev" @next="handleNext" @go-to="handleGoTo" />
  </div>
</template>

<style lang="scss" scoped>
.analysis-setup-content {
  padding-top: 16px;

  .settings-group {
    padding: 0 0 16px 0;

    &.has-divider {
      border-bottom: 1px solid var(--border-secondary-color);
      margin-bottom: 16px;
    }
  }

  .group-header {
    font-weight: 500;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;

    .item-icon {
      font-size: 1.2rem;
      color: var(--fg-secondary-color);
    }
  }

  .start-btn {
    width: 100%;
    margin-top: 8px;

    .btn-icon {
      margin-right: 6px;
    }
  }
}
.settings-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;

  :deep(.kit-checkbox) {
    .checkbox-box {
      margin-left: 2px;
    }

    .checkbox-label {
      margin-left: 6px;
      font-weight: 500;
    }
  }
}
.reader-view {
  padding-top: var(--safe-area-top);
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;
  overflow-x: hidden;
  background-color: var(--bg-primary-color);
}
.reader-content-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-top: 80px;
  min-height: calc(100% - 70px);
}
.reader-layout-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 24px;

  &.is-continuous {
    padding: 0 24px;
  }

  @include media-down(sm) {
    padding: 16px;

    &.is-continuous {
      padding: 0 16px;
    }
  }
}

.reader-continuous-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.scroll-sentinel {
  width: 100%;
  min-height: 20px;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;

  &.bottom-sentinel {
    min-height: 60px;
  }
}

.continuous-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fg-secondary-color);
  font-size: 0.9rem;
  padding: 16px;

  .spin-icon {
    animation: spin 1s linear infinite;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-in-only-enter-active {
  transition: opacity 0.25s ease-out;
}
.fade-in-only-enter-from {
  opacity: 0;
}
.fade-in-only-leave-active {
  transition: none !important;
  display: none !important;
}
.fade-in-only-leave-to {
  opacity: 0;
}
</style>
