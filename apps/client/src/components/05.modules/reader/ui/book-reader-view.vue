<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox, KitDialog } from '~/components/01.kit'
import { PageLoader } from '~/components/02.shared/page-loader'
import { useTextSelection } from '~/components/04.features/analysis/index.ts'
import { useAnalysisStore } from '~/shared/store/analysis/analysis.store.ts'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useParallelSync } from '../composables/use-parallel-sync.ts'
import { useReaderContent } from '../composables/use-reader-content.ts'
import { useReaderDomHighlights } from '../composables/use-reader-dom-highlights.ts'
import { useReaderNavigation } from '../composables/use-reader-navigation.ts'
import { useReaderScroll } from '../composables/use-reader-scroll.ts'
import { useReadingSession } from '../composables/use-reading-session.ts'
import { useScrollRestoration } from '../composables/use-scroll-restoration.ts'
import { useReaderStore } from '../store/reader.store.ts'

import ReaderTocDialog from './dialog/reader-toc-dialog.vue'
import ReaderBrightness from './partials/reader-brightness.vue'
import ReaderFooter from './partials/reader-footer.vue'
import ReaderHeader from './partials/reader-header.vue'

const PageAnalysisModal = lazyComponent(() => import('~/components/04.features/analysis/ui/modal/page-analysis-modal.vue'))
const SelectionTooltip = lazyComponent(() => import('~/components/04.features/analysis/ui/selection-tooltip.vue'))
const SentenceAnalysis = lazyComponent(() => import('~/components/04.features/analysis/ui/sentence-analysis.vue'))
const WordPopover = lazyComponent(() => import('~/components/04.features/analysis/ui/popover/word-popover.vue'))
const GrammarPopover = lazyComponent(() => import('~/components/04.features/analysis/ui/popover/grammar-popover.vue'))

const readerStore = useReaderStore()
const analysisStore = useAnalysisStore()
const settingsStore = useGlobalSettingsStore()
const { t } = useI18n()
const readerViewRef = useTemplateRef<HTMLElement>('readerViewRef')
useAppWakeLock(() => analysisStore.isManualPageAnalysisActive || analysisStore.isAutoPageAnalysisActive)
useReadingSession()

const { saveScrollPosition, restoreScrollPosition, setScrollIntent } = useScrollRestoration(
  readerViewRef,
  () => readerStore.currentBook?.id,
  () => readerStore.currentPage?.pageNum,
  () => readerStore.isPageLoading,
)

const { onSentenceHover, onSentenceOut } = useReaderDomHighlights(readerViewRef)
const { prevPage, nextPage, goToPage } = useReaderNavigation(setScrollIntent)
const { onPointerDown, onPointerUp, onWordClick } = useTextSelection()

const { isHeaderVisible, onScroll } = useReaderScroll(saveScrollPosition)
const { performLayoutSync } = useParallelSync(readerViewRef, restoreScrollPosition)
const { leftPaneContent, translatedPageContent, pageTranslationProgress } = useReaderContent()

function startPageTranslationOnly() {
  analysisStore.analyzeWholePage({
    sentences: true,
    words: false,
    ttsSentences: false,
    ttsWords: false,
  }, true)
}

function startPageAnalysis() {
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

  const { highlightCodeBlocks } = await import('~/shared/lib/shiki-highlighter')
  const themeAttr = document.documentElement.getAttribute('data-theme')
  const isDark = themeAttr === 'dark' || themeAttr === 'oled'

  await highlightCodeBlocks(readerViewRef.value, isDark)
}

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

  setTimeout(performLayoutSync, 50)
})

watch(() => readerStore.isPageLoading, async (isLoading) => {
  if (!isLoading && readerStore.currentPage) {
    await nextTick()
    await applyCodeHighlighting()
    setTimeout(performLayoutSync, 50)
  }
}, { immediate: true })
</script>

<template>
  <div ref="readerViewRef" class="reader-view" @scroll.passive="onScroll">
    <ReaderHeader :is-visible="isHeaderVisible" />

    <div class="reader-content-wrapper">
      <div v-if="readerStore.isPageLoading && !readerStore.currentPage" class="reader-loading-wrapper">
        <div class="spinner-box">
          <PageLoader />
        </div>
        <h3 class="loading-text">
          {{ t('reader.preparingPageTitle') }}
        </h3>
        <p class="loading-subtext">
          {{ t('reader.preparingPageDesc') }}
        </p>
      </div>

      <div
        v-else-if="readerStore.currentPage"
        :key="readerStore.currentPage.pageNum"
        class="reader-layout-wrapper page-enter-anim"
        :class="{ 'is-loading': readerStore.isPageLoading }"
      >
        <div class="reader-content-layout" :class="{ 'is-parallel': readerStore.isParallelView }">
          <div
            class="reader-content left-pane js-tooltip-selectable"
            :style="{
              fontSize: `${settingsStore.readerFontSize}rem`,
              lineHeight: settingsStore.readerLineHeight,
              fontFamily: settingsStore.readerFontFamily,
            }"
            @click="onWordClick"
            @mousedown="onPointerDown"
            @touchstart="onPointerDown"
            @mouseup="onPointerUp"
            @touchend="onPointerUp"
            @touchcancel="onPointerUp"
            @mouseleave="onPointerUp"
            @mouseover="onSentenceHover"
            @mouseout="onSentenceOut"
            v-html="leftPaneContent"
          />

          <div
            v-if="readerStore.isParallelView"
            class="reader-content right-pane"
            :style="{
              fontSize: `${settingsStore.readerFontSize}rem`,
              lineHeight: settingsStore.readerLineHeight,
              fontFamily: settingsStore.readerFontFamily,
            }"
          >
            <div
              v-if="pageTranslationProgress.isFullyTranslated"
              class="translated-content-wrapper"
              @click="onWordClick"
              @mousedown="onPointerDown"
              @touchstart="onPointerDown"
              @mouseup="onPointerUp"
              @touchend="onPointerUp"
              @touchcancel="onPointerUp"
              @mouseleave="onPointerUp"
              @mouseover="onSentenceHover"
              @mouseout="onSentenceOut"
              v-html="translatedPageContent"
            />
            <div v-else class="untranslated-overlay-container">
              <div
                class="untranslated-content is-blurred"
                v-html="leftPaneContent"
              />
              <div class="untranslated-overlay-action">
                <div class="hint-text">
                  {{ t('reader.parallelViewRequiresFullTranslation', 'Для отображения текста необходимо перевести все предложения на странице.') }}
                </div>

                <div v-if="analysisStore.isAutoPageAnalysisActive || analysisStore.isManualPageAnalysisActive" class="translation-progress">
                  <div class="progress-info">
                    <span>{{ t('reader.translatingSentences', 'Перевод предложений...') }}</span>
                    <span>{{ pageTranslationProgress.translated }} / {{ pageTranslationProgress.total }}</span>
                  </div>
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" :style="{ width: `${pageTranslationProgress.percentage}%` }" />
                  </div>
                </div>

                <KitBtn
                  v-else
                  color="primary"
                  class="action-btn"
                  @click="startPageTranslationOnly"
                >
                  <Icon icon="mdi:translate" class="btn-icon" /> {{ t('reader.translatePage', 'Перевести страницу') }}
                </KitBtn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <GrammarPopover />

    <KitDialog
      v-model:visible="analysisStore.isPageAnalysisSetupModalOpen"
      :title="t('reader.analyzePage')"
      :max-width="400"
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

    <ReaderTocDialog @go-to="goToPage" />
    <WordPopover />
    <SelectionTooltip />
    <SentenceAnalysis />
    <PageAnalysisModal />
    <ReaderBrightness />

    <ReaderFooter @prev="prevPage" @next="nextPage" @go-to="goToPage" />
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
  transition: opacity 0.2s ease;

  &.is-loading {
    opacity: 0.6;
    pointer-events: none;
  }

  @include media-down(sm) {
    padding: 16px;
  }
}
.reader-content-layout {
  display: flex;
  width: 100%;
  max-width: 800px;
  transition: max-width 0.3s ease;
  gap: 48px;
  &.is-parallel {
    max-width: 1600px;
    .left-pane,
    .right-pane {
      flex: 1;
      min-width: 0;
    }
    .right-pane {
      border-left: 1px dashed var(--border-secondary-color);
      padding-left: 48px;
    }
    @include media-down(md) {
      flex-direction: column;
      gap: 24px;
      .right-pane {
        border-left: none;
        border-top: 1px dashed var(--border-secondary-color);
        padding-left: 0;
        padding-top: 24px;
      }
    }
  }
}
.reader-content {
  width: 100%;
  color: var(--fg-primary-color);
  user-select: text;
  word-wrap: break-word;
  font-size: 1.4rem;
  line-height: 1.8;
  font-family: 'Maple Mono CN', 'Microsoft YaHei', sans-serif;
  transition:
    font-size 0.2s,
    line-height 0.2s;

  :deep(svg) {
    height: auto;
  }

  @include media-down(sm) {
    user-select: none;
  }

  & ::selection {
    background-color: var(--bg-accent-overlay-color);
  }
  :deep(p) {
    margin-bottom: 1.2em;
    text-indent: 1.5em;
  }
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin-top: 1.5em;
    margin-bottom: 0.8em;
    font-weight: 600;
    line-height: 1.3;
    text-align: center;
    color: var(--fg-accent-color);
  }
  :deep(img),
  :deep(image) {
    max-width: 100%;
    height: auto !important;
    display: block;
    margin: 1.5em auto;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  :deep(blockquote) {
    border-left: 4px solid var(--fg-secondary-color);
    margin: 1em 0;
    padding-left: 1em;
    font-style: italic;
    color: var(--fg-secondary-color);
  }
  :deep(pre),
  :deep(.shiki) {
    font-size: 0.75em;
    max-width: 100%;
    overflow-x: auto;
    white-space: pre;
    padding: 12px 16px;
    margin: 1.2em 0;
    border-radius: 8px;
    box-sizing: border-box;

    code {
      font-size: inherit;
    }
  }
  :deep(b),
  :deep(strong) {
    font-weight: bold;
  }
  :deep(i),
  :deep(em) {
    font-style: italic;
  }
  :deep(.sentence) {
    display: inline;
    cursor: pointer;
    transition: background-color 0.2s ease;
    &:hover,
    &.is-hovered {
      background-color: var(--bg-hover-color);
    }
  }
  :deep(.sentence-tts-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: text-bottom;
    position: relative;
    top: -2px;
    width: 28px;
    height: 28px;
    margin-left: 8px;
    margin-right: 4px;
    border: none;
    background: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;
    border-radius: 50%;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0.6;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

    .icon-play,
    .icon-playing {
      width: 16px;
      height: 16px;
    }

    .icon-playing {
      display: none;
    }

    &.is-playing {
      opacity: 1;
      color: var(--fg-accent-color);
      .icon-play {
        display: none;
      }
      .icon-playing {
        display: block;
        animation: pulse 1.5s infinite ease-in-out;
      }
    }

    &:hover {
      opacity: 1;
      background-color: var(--fg-accent-color);
      color: var(--bg-primary-color);
      transform: scale(1.15);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    &:active {
      transform: scale(0.95);
    }
  }
  :deep(.untranslated-text) {
    opacity: 0.4;
  }
  :deep(.word) {
    padding: 0;
    border-radius: 4px;
    &.exact-highlight {
      border-radius: 0;
    }
    transition:
      background-color 0.1s,
      color 0.1s;
    &.add-space {
      padding-right: 0.25em;
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
      font-weight: 600;
    }
  }
  :deep(.interleaved-translation) {
    display: block;
    text-indent: 0;
    color: var(--fg-secondary-color);
    font-size: 0.9em;
    margin-top: 4px;
    margin-bottom: 12px;
    line-height: 1.5;
    padding-left: 8px;
    border-left: 2px solid var(--border-secondary-color);

    &.is-blurred {
      filter: blur(5px);
      cursor: pointer;
      opacity: 0.7;
      transition:
        filter 0.2s,
        opacity 0.2s;

      &:hover {
        opacity: 1;
      }
    }
  }
  :deep(.split-translation) {
    display: block;
    text-indent: 0;

    &.is-blurred {
      filter: blur(5px);
      cursor: pointer;
      opacity: 0.7;
      transition:
        filter 0.2s,
        opacity 0.2s;

      &:hover {
        opacity: 1;
      }
    }
  }

  :deep(.interleaved-translation),
  :deep(.split-translation) {
    .grammar-rules-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    .grammar-rule-badge {
      display: inline-flex;
      align-items: center;
      background-color: var(--bg-hover-color, rgba(0, 0, 0, 0.04));
      color: var(--fg-secondary-color);
      border: 1px solid var(--border-primary-color);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.56em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;

      &:hover {
        color: var(--fg-secondary-color);
        background-color: var(--border-primary-color);
      }

      &:active {
        background-color: var(--border-secondary-color);
      }
    }

    &.is-blurred {
      .grammar-rule-badge {
        color: var(--fg-secondary-color);
        background-color: var(--bg-hover-color, rgba(0, 0, 0, 0.02));
        border-color: transparent;
        box-shadow: none;
        pointer-events: none;
      }
    }
  }
}
.reader-loading-wrapper {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 32px;
  text-align: center;
  .spinner-box {
    height: 80px;
    margin-bottom: 24px;
    :deep(.page-loader) {
      min-height: unset;
    }
  }
  .loading-text {
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0 0 8px 0;
  }
  .loading-subtext {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }
}

@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.page-enter-anim {
  animation: pageEnter 0.2s ease-out 0.1s both;
}

.untranslated-overlay-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.untranslated-content {
  opacity: 0.25;
  filter: blur(4px);
  pointer-events: none;
  user-select: none;
  transition: all 0.3s ease;
}

.untranslated-overlay-action {
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-primary-color);
  padding: 24px 32px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  border: 1px solid var(--border-secondary-color);
  width: 90%;
  max-width: 400px;
  text-align: center;
  z-index: 10;

  .hint-text {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    margin-bottom: 20px;
    line-height: 1.5;
  }

  .action-btn {
    width: 100%;
    .btn-icon {
      margin-right: 8px;
      font-size: 1.2rem;
    }
  }
}

.translation-progress {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;

  .progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    font-weight: 500;
  }

  .progress-bar-bg {
    width: 100%;
    height: 8px;
    background-color: var(--bg-secondary-color);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background-color: var(--fg-accent-color);
    border-radius: 4px;
    transition: width 0.3s ease;
  }
}
</style>
