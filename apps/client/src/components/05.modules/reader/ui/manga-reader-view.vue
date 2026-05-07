<script setup lang="ts">
import { KitBtn, KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'
import { useBooksStore } from '~/shared/store/books.store'
import ReaderFooter from './reader-footer.vue'
import ReaderHeader from './reader-header.vue'
import SelectionTooltip from './selection-tooltip.vue'
import SentenceAnalysis from './sentence-analysis.vue'
import WordPopover from './word-popover.vue'

const store = useBooksStore()
const router = useRouter()
const route = useRoute()

const BASE = import.meta.env.VITE_API_URL || 'https://insight-api.trip-scheduler.ru'

const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')

watch(() => store.activeTokenId, (newId, oldId) => {
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
  if (!store.currentPage?.imageWidth || !store.currentPage?.imageHeight)
    return {}
  return {
    left: `${(box.x / store.currentPage.imageWidth) * 100}%`,
    top: `${(box.y / store.currentPage.imageHeight) * 100}%`,
    width: `${(box.w / store.currentPage.imageWidth) * 100}%`,
    height: `${(box.h / store.currentPage.imageHeight) * 100}%`,
  }
}

let pressTimer: ReturnType<typeof setTimeout> | null = null

function onPointerDown(event: MouseEvent | TouchEvent, fallbackText: string) {
  const target = (event.target as HTMLElement).closest('.sentence') as HTMLElement | null
  let rawSent = fallbackText

  if (target && target.dataset.rawSent) {
    rawSent = decodeURIComponent(target.dataset.rawSent)
  }
  else {
    rawSent = rawSent.replace(/\n+/g, '') // Если кликнули мимо токенизированного текста
  }

  pressTimer = setTimeout(() => {
    store.closePopover()
    store.closeSelectionTooltip()
    window.getSelection()?.empty()
    store.handleSentenceAnalysis(rawSent)
    pressTimer = null
  }, 500)
}

function onPointerUp() {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }
}

function onContentClick(event: MouseEvent) {
  if (pressTimer) {
    clearTimeout(pressTimer)
    pressTimer = null
  }

  const target = (event.target as HTMLElement).closest('.word') as HTMLElement | null
  if (!target)
    return

  const pos = target.dataset.pos
  if (pos === 'x')
    return

  const word = decodeURIComponent(target.dataset.word || '')
  const sentenceId = Number(target.dataset.sentId)
  const tokenIndex = Number(target.dataset.tokenIdx)

  if (!word || Number.isNaN(sentenceId) || Number.isNaN(tokenIndex) || !pos)
    return

  window.getSelection()?.empty()

  event.stopPropagation()
  store.handleWordClick(word, pos, sentenceId, tokenIndex, target)
}

function onScroll() {
  if (store.wordPopover) {
    store.closePopover()
  }
  if (store.selectionTooltip) {
    store.closeSelectionTooltip()
  }
}

function prevPage() {
  if (store.currentBook && (store.currentBook.currentPage || 1) > 1) {
    const newPage = (store.currentBook.currentPage || 1) - 1
    store.loadPage(store.currentBook.id, newPage)
    router.replace({ query: { ...route.query, page: newPage } })
    window.scrollTo({ top: 0 })
  }
}

function nextPage() {
  if (store.currentBook && (store.currentBook.currentPage || 1) < store.currentBook.totalPages) {
    const newPage = (store.currentBook.currentPage || 1) + 1
    store.loadPage(store.currentBook.id, newPage)
    router.replace({ query: { ...route.query, page: newPage } })
    window.scrollTo({ top: 0 })
  }
}

function goToPage(pageNum?: number) {
  if (!pageNum || !store.currentBook)
    return
  store.tocOpen = false
  store.loadPage(store.currentBook.id, pageNum)
  router.replace({ query: { ...route.query, page: pageNum } })
}
</script>

<template>
  <div ref="readerViewRef" class="manga-reader-view" @scroll.passive="onScroll">
    <ReaderHeader />

    <div class="reader-content-wrapper">
      <div v-if="store.isPageLoading || store.isLoading" class="reader-loading-wrapper">
        <PageLoader />
        <p class="loading-text">
          Подготовка страницы (OCR & NLP)...
        </p>
      </div>

      <div v-else-if="store.currentPage?.imageUrl" class="manga-container">
        <!-- Вешаем обработчики на обертку для делегирования -->
        <div
          class="manga-page-wrapper js-tooltip-selectable"
          @click="onContentClick"
          @mouseup="onPointerUp"
          @touchend="onPointerUp"
          @touchcancel="onPointerUp"
          @mouseleave="onPointerUp"
        >
          <img :src="`${BASE}${store.currentPage.imageUrl}`" class="manga-image">

          <div class="ocr-overlay">
            <div
              v-for="box in store.currentPage.ocrBlocks"
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
    </div>

    <Transition name="fade">
      <div v-if="store.isAnalyzingPage" class="page-analysis-overlay">
        <div class="analysis-dialog">
          <h3>Анализ страницы</h3>
          <p>Обработано {{ store.pageAnalysisCurrent }} из {{ store.pageAnalysisTotal }} блоков...</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${store.pageAnalysisProgress}%` }" />
          </div>
          <KitBtn color="secondary" variant="outlined" @click="store.cancelPageAnalysis">
            Отмена
          </KitBtn>
        </div>
      </div>
    </Transition>

    <ReaderFooter @prev="prevPage" @next="nextPage" />

    <KitDialog v-model:visible="store.tocOpen" title="Навигация" :max-width="500">
      <div class="toc-list">
        <div v-for="i in store.currentBook?.totalPages" :key="i" class="toc-item" @click="goToPage(i)">
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
  min-height: 100dvh;
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

/* ================================
   СТИЛИ OCR БЛОКОВ И СЛОВ
   ================================ */
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

    // Центрирование контента, не ломающее inline-spans
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;

    text-shadow:
      -1px -1px 0 var(--bg-primary-color),
      1px -1px 0 var(--bg-primary-color),
      -1px 1px 0 var(--bg-primary-color),
      1px 1px 0 var(--bg-primary-color);

    /* Глобальные стили для токенов, инжектируемых v-html */
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
        text-shadow: none; // Убираем тень, чтобы белый текст на цветном фоне не сливался
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
  z-index: 10000;
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
