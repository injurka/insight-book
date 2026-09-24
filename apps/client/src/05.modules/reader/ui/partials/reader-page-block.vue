<script setup lang="ts">
import type { PagePayload } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { useQuoteHighlights } from '../../composables/use-quote-highlights'
import { useReaderContent } from '../../composables/use-reader-content'

interface Props {
  page: PagePayload
  isParallelView: boolean
  showPageDivider?: boolean
  totalPages?: number
}

const props = withDefaults(defineProps<Props>(), {
  showPageDivider: false,
})

const emit = defineEmits<{
  wordClick: [e: MouseEvent]
  pointerDown: [e: MouseEvent | TouchEvent]
  pointerUp: [e: MouseEvent | TouchEvent]
  sentenceHover: [e: MouseEvent]
  sentenceOut: [e: MouseEvent]
  translatePage: [pageNum: number]
}>()

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const analysisStore = useAnalysisStore()
const blockRef = useTemplateRef<HTMLElement>('blockRef')

const { leftPaneContent, translatedPageContent, pageTranslationProgress } = useReaderContent(() => props.page)
useQuoteHighlights(blockRef, [leftPaneContent, translatedPageContent], () => props.page.pageNum)
</script>

<template>
  <div ref="blockRef" class="reader-page-block" :data-page-num="page.pageNum">
    <div v-if="showPageDivider" class="page-divider" :class="{ 'is-parallel': isParallelView }">
      <span class="divider-line" />
      <span class="divider-text">{{ t('reader.pageDivider', { page: page.pageNum, total: totalPages }) }}</span>
      <span class="divider-line" />
    </div>

    <div class="reader-content-layout" :class="{ 'is-parallel': isParallelView }">
      <div
        class="reader-content left-pane js-tooltip-selectable"
        :style="{
          fontSize: `${settingsStore.readerFontSize}rem`,
          lineHeight: settingsStore.readerLineHeight,
          fontFamily: settingsStore.readerFontFamily,
        }"
        @click="emit('wordClick', $event)"
        @mousedown="emit('pointerDown', $event)"
        @touchstart="emit('pointerDown', $event)"
        @mouseup="emit('pointerUp', $event)"
        @touchend="emit('pointerUp', $event)"
        @touchcancel="emit('pointerUp', $event)"
        @mouseleave="emit('pointerUp', $event)"
        @mouseover="emit('sentenceHover', $event)"
        @mouseout="emit('sentenceOut', $event)"
        v-html="leftPaneContent"
      />

      <div
        v-if="isParallelView"
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
          @click="emit('wordClick', $event)"
          @mousedown="emit('pointerDown', $event)"
          @touchstart="emit('pointerDown', $event)"
          @mouseup="emit('pointerUp', $event)"
          @touchend="emit('pointerUp', $event)"
          @touchcancel="emit('pointerUp', $event)"
          @mouseleave="emit('pointerUp', $event)"
          @mouseover="emit('sentenceHover', $event)"
          @mouseout="emit('sentenceOut', $event)"
          v-html="translatedPageContent"
        />
        <div v-else class="untranslated-overlay-container">
          <div
            class="untranslated-content is-blurred"
            v-html="leftPaneContent"
          />
          <div class="untranslated-overlay-action">
            <div class="hint-text">
              {{ t('reader.parallelReadingHint', 'Для отображения текста необходимо перевести все предложения на странице.') }}
            </div>

            <div v-if="analysisStore.isAutoPageAnalysisActive || analysisStore.isManualPageAnalysisActive" class="translation-progress">
              <div class="progress-info">
                <span>{{ t('reader.translatingPage', 'Перевод предложений...') }}</span>
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
              @click="emit('translatePage', page.pageNum)"
            >
              <Icon icon="mdi:translate" class="btn-icon" /> {{ t('reader.translateWholePage', 'Перевести страницу') }}
            </KitBtn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.reader-page-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.page-divider {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 800px;
  margin: 36px 0 24px;
  gap: 16px;
  color: var(--fg-muted-color);
  font-size: 0.85rem;
  font-weight: 500;
  user-select: none;
  transition: max-width 0.3s ease;

  &.is-parallel {
    max-width: 1600px;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background-color: var(--border-secondary-color);
  }

  .divider-text {
    padding: 3px 12px;
    border-radius: 12px;
    background-color: var(--bg-secondary-color);
    letter-spacing: 0.5px;
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
  font-family: var(--app-font-family);
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

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        opacity: 1;
        background-color: var(--fg-accent-color);
        color: var(--bg-primary-color);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
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

      &.add-space {
        font-weight: inherit;
      }
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
      user-select: none;
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
      user-select: none;
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
