<script setup lang="ts">
import { useWakeLock } from '@vueuse/core'
import { KitBtn, KitDialog } from '~/components/01.kit'

import { PageLoader } from '~/components/02.shared/page-loader'
import { SelectionTooltip, SentenceAnalysis, useTextSelection, WordPopover } from '~/components/03.domain/analysis'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { getMediaUrl } from '~/workers/service/lib/utils'

import { useReaderStore } from '../store/reader.store'
import ReaderFooter from './reader-footer.vue'
import ReaderHeader from './reader-header.vue'

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const router = useRouter()
const route = useRoute()

const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()

const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')

const { isSupported: isWakeLockSupported, request: requestWakeLock, release: releaseWakeLock } = useWakeLock()

watch(() => analysisStore.isAnalyzingPage, async (isAnalyzing) => {
  if (!isWakeLockSupported.value)
    return
  if (isAnalyzing) {
    try {
      await requestWakeLock('screen')
    }
    catch (err) {
      console.warn('Wake Lock request failed:', err)
    }
  }
  else {
    await releaseWakeLock()
  }
})

watch(() => analysisStore.activeTokenId, (newId, oldId) => {
  if (oldId) {
    const [sentId, tokenIdx] = oldId.split('-')
    const el = readerViewRef.value?.querySelector(`.word[data-sent-id="${sentId}"][data-token-idx="${tokenIdx}"]`)
    if (el)
      el.classList.remove('is-active')
  }
  if (newId) {
    const [sentId, tokenIdx] = newId.split('-')
    const el = readerViewRef.value?.querySelector(`.word[data-sent-id="${sentId}"][data-token-idx="${tokenIdx}"]`)
    if (el)
      el.classList.add('is-active')
  }
})

function getBoxStyle(box: any) {
  if (!readerStore.currentPage?.imageWidth || !readerStore.currentPage?.imageHeight)
    return {}
  return {
    left: `${(box.x / readerStore.currentPage.imageWidth) * 100}%`,
    top: `${(box.y / readerStore.currentPage.imageHeight) * 100}%`,
    width: `${(box.w / readerStore.currentPage.imageWidth) * 100}%`,
    height: `${(box.h / readerStore.currentPage.imageHeight) * 100}%`,
  }
}

async function prevPage() {
  if (readerStore.currentBook && (readerStore.currentBook.currentPage || 1) > 1) {
    const newPage = (readerStore.currentBook.currentPage || 1) - 1
    try {
      await readerStore.loadPage(readerStore.currentBook.id, newPage)
      router.replace({ query: { ...route.query, page: newPage } })
      readerViewRef.value?.scrollTo({ top: 0, behavior: 'instant' })
    }
    catch {}
  }
}

async function nextPage() {
  if (readerStore.currentBook && (readerStore.currentBook.currentPage || 1) < readerStore.currentBook.totalPages) {
    const newPage = (readerStore.currentBook.currentPage || 1) + 1
    try {
      await readerStore.loadPage(readerStore.currentBook.id, newPage)
      router.replace({ query: { ...route.query, page: newPage } })
      readerViewRef.value?.scrollTo({ top: 0, behavior: 'instant' })
    }
    catch {}
  }
}

async function goToPage(pageNum?: number) {
  if (!pageNum || !readerStore.currentBook)
    return
  readerStore.tocOpen = false
  try {
    await readerStore.loadPage(readerStore.currentBook.id, pageNum)
    router.replace({ query: { ...route.query, page: pageNum } })
    readerViewRef.value?.scrollTo({ top: 0, behavior: 'instant' })
  }
  catch {}
}

function onScroll() {
  if (analysisStore.wordPopover) {
    analysisStore.closePopover()
  }
  if (analysisStore.selectionTooltip) {
    analysisStore.closeSelectionTooltip()
  }
}
</script>

<template>
  <div ref="readerViewRef" class="manga-reader-view" @scroll.passive="onScroll">
    <ReaderHeader />

    <div class="reader-content-wrapper">
      <Transition name="fade" mode="out-in">
        <div v-if="readerStore.isPageLoading" class="reader-loading-wrapper">
          <PageLoader />
          <p class="loading-text">
            Подготовка страницы (OCR & NLP)...
          </p>
        </div>

        <div v-else-if="readerStore.currentPage?.imageUrl" class="manga-container">
          <div
            class="manga-page-wrapper js-tooltip-selectable"
            @click="onWordClick"
            @mouseup="onPointerUp"
            @touchend="onPointerUp"
            @touchcancel="onPointerUp"
            @mouseleave="onPointerUp"
          >
            <img :src="`${getMediaUrl(readerStore.currentPage.imageUrl)}`" class="manga-image">

            <div class="ocr-overlay">
              <div
                v-for="box in readerStore.currentPage.ocrBlocks"
                :key="box.id"
                class="ocr-bubble"
                :style="getBoxStyle(box)"
                @mousedown="onPointerDown($event, box.text)"
                @touchstart="onPointerDown($event, box.text)"
              >
                <div class="bubble-text-preview" v-html="box.html || box.text.replace(/\n+/g, '')" />
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <Transition name="fade">
      <div v-if="analysisStore.isAnalyzingPage" class="page-analysis-overlay">
        <div class="analysis-dialog">
          <h3>Анализ страницы</h3>
          <p>Обработано <b>{{ analysisStore.pageAnalysisCurrent }}</b> из <b>{{ analysisStore.pageAnalysisTotal }}</b> элементов...</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${analysisStore.pageAnalysisProgress}%` }" />
          </div>
          <KitBtn color="secondary" variant="outlined" @click="analysisStore.cancelPageAnalysis">
            Отмена
          </KitBtn>
        </div>
      </div>
    </Transition>

    <ReaderFooter @prev="prevPage" @next="nextPage" @go-to="goToPage" />

    <KitDialog v-model:visible="readerStore.tocOpen" title="Навигация" :max-width="500">
      <div class="toc-list">
        <div v-for="i in readerStore.currentBook?.totalPages" :key="i" class="toc-item" @click="goToPage(i)">
          <span class="toc-title">Страница {{ i }}</span>
        </div>
      </div>
    </KitDialog>

    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
  </div>
</template>

<style lang="scss" scoped>
.manga-reader-view {
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary-color);
  overflow-y: auto;
  overflow-x: hidden;

  &[data-theme='light'] {
    background-color: #f5f5f5;
  }
  &[data-theme='dark'] {
    background-color: #0d1117;
  }
}

.reader-content-wrapper {
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
}

.manga-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.manga-page-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;

  & ::selection {
    background-color: var(--bg-accent-overlay-color);
  }
}

.manga-image {
  max-width: 100%;
  max-height: 85vh;
  display: block;
  object-fit: contain;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.ocr-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.ocr-bubble {
  position: absolute;
  pointer-events: auto;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    inset: -12px;
    border-radius: 12px;
    background-color: transparent;
    transition: all 0.2s ease;
    z-index: 1;
  }

  .bubble-text-preview {
    position: absolute;
    inset: 0;
    z-index: 2;
    opacity: 0;
    color: var(--fg-primary-color);
    font-size: 0.95rem;
    font-weight: 600;
    text-align: center;
    word-break: break-all;
    transition: opacity 0.2s ease;

    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;

    text-shadow:
      -1px -1px 0 var(--bg-primary-color),
      1px -1px 0 var(--bg-primary-color),
      -1px 1px 0 var(--bg-primary-color),
      1px 1px 0 var(--bg-primary-color);

    :deep(.sentence) {
      display: inline;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s ease;

      &:hover {
        background-color: var(--bg-hover-color);
      }
    }

    :deep(.word) {
      padding: 0;
      border-radius: 4px;
      transition:
        background-color 0.1s,
        color 0.1s;

      &.add-space {
        margin-right: 0.25em;
      }

      &.is-punctuation {
        cursor: default;
        &:hover {
          background-color: transparent;
          color: inherit;
        }
      }

      &.is-active {
        background-color: var(--fg-accent-color);
        color: var(--bg-primary-color);
        font-weight: bold;
        text-shadow: none;
      }
    }
  }

  &:hover {
    &::before {
      background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.4);
      backdrop-filter: blur(4px) brightness(1.2);
    }
    .bubble-text-preview {
      opacity: 1;
    }
  }
}

.reader-loading-wrapper {
  text-align: center;
  .loading-text {
    margin-top: 16px;
    color: var(--fg-secondary-color);
  }
}

.page-analysis-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: var(--z-modal, 1200);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;

  .analysis-dialog {
    background-color: var(--bg-secondary-color);
    padding: 24px;
    border-radius: 12px;
    border: 1px solid var(--border-primary-color);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    text-align: center;
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 16px;

    h3 {
      margin: 0;
      color: var(--fg-primary-color);
      font-size: 1.25rem;
    }

    p {
      margin: 0;
      color: var(--fg-secondary-color);
      font-size: 0.95rem;
      font-variant-numeric: tabular-nums;

      b {
        color: var(--fg-primary-color);
      }
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: var(--bg-tertiary-color);
      border-radius: 4px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background-color: var(--fg-accent-color);
        transition: width 0.3s ease;
      }
    }
  }
}

.toc-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
}

.toc-item {
  padding: 8px;
  text-align: center;
  cursor: pointer;
  border-radius: 8px;
  background-color: var(--bg-secondary-color);

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
  }
}
</style>
