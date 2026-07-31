<script setup lang="ts">
import type { Book, Highlight } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitTooltip } from '~/02.kit'
import { PronunciationCheck } from '~/04.features/pronunciation-check'
import { highlightTextQuery } from '~/05.modules/notebook/lib/text-tokenizer'

interface Props {
  highlight: Highlight
  book: Book
  searchQuery: string
  activeTtsId: number | null
  translatingId: number | null
  isPlayingTts: boolean
  isLoadingTts: boolean
  isTtsActive: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  openAnalysis: [h: Highlight]
  playTts: [h: Highlight, book: Book]
  translateQuote: [h: Highlight, book: Book]
  openEditModal: [h: Highlight]
  confirmDelete: [h: Highlight]
}>()

const { t } = useI18n()
</script>

<template>
  <div
    class="highlight-item"
    :style="{ '--highlight-color': highlight.color || '#fde047', 'cursor': highlight.analysisData ? 'pointer' : 'default' }"
    @click="highlight.analysisData ? emit('openAnalysis', highlight) : null"
  >
    <div class="highlight-body">
      <div class="quote-content">
        <p class="highlight-text">
          “<span v-html="highlightTextQuery(highlight.text, searchQuery)" />”
        </p>
        <p v-if="highlight.translation" class="highlight-translation" v-html="highlightTextQuery(highlight.translation, searchQuery)" />
      </div>

      <div v-if="highlight.note" class="highlight-note">
        <Icon icon="mdi:pencil-outline" class="note-icon" />
        <p class="text">
          {{ highlight.note }}
        </p>
      </div>
    </div>

    <div class="highlight-footer">
      <div class="highlight-info">
        <span v-if="highlight.chapter" class="chapter-badge">
          {{ t('notebook.chapter', { chapter: highlight.chapter }) }}
        </span>
        <span class="page-badge">
          {{ t('notebook.page', { page: highlight.pageNum }) }}
        </span>
        <span class="date-badge">
          {{ new Date(highlight.createdAt).toLocaleDateString() }}
        </span>
      </div>
      <div class="highlight-actions" @click.stop>
        <PronunciationCheck :word="highlight.text" :language="book.language" variant="button" />
        <!-- TTS Audio Playback Button -->
        <KitTooltip :text="activeTtsId === highlight.id && isPlayingTts ? t('bookInfo.stop') : t('notebook.speak')" placement="top">
          <KitBtn
            class="tts-speak-btn"
            :icon="activeTtsId === highlight.id && isPlayingTts ? 'mdi:stop' : 'mdi:volume-high'"
            :class="{ 'pulse-animation': activeTtsId === highlight.id && isPlayingTts }"
            :loading="activeTtsId === highlight.id && isLoadingTts"
            variant="text"
            size="xs"
            color="primary"
            :disabled="activeTtsId !== null && activeTtsId !== highlight.id && isTtsActive"
            @click.stop="emit('playTts', highlight, book)"
          />
        </KitTooltip>

        <!-- AI Translate Button -->
        <KitTooltip v-if="!highlight.translation" :text="translatingId === highlight.id ? t('notebook.translating') : t('notebook.aiTranslate')" placement="top">
          <KitBtn
            class="ai-translate-btn"
            icon="mdi:translate"
            :loading="translatingId === highlight.id"
            variant="text"
            size="xs"
            color="primary"
            :disabled="translatingId !== null"
            @click.stop="emit('translateQuote', highlight, book)"
          />
        </KitTooltip>

        <KitTooltip :text="t('notebook.editQuote')" placement="top">
          <KitBtn
            icon="mdi:pencil"
            variant="text"
            size="xs"
            color="secondary"
            @click.stop="emit('openEditModal', highlight)"
          />
        </KitTooltip>
        <KitTooltip :text="t('notebook.deleteQuote')" placement="top-end">
          <KitBtn
            icon="mdi:delete-outline"
            variant="text"
            size="xs"
            color="error"
            @click.stop="emit('confirmDelete', highlight)"
          />
        </KitTooltip>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.highlight-item {
  position: relative;
  background-color: var(--bg-secondary-color);
  border-radius: 8px;
  border-left: 4px solid var(--highlight-color, #fde047);
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .quote-content {
    .highlight-text {
      font-size: 1.05rem;
      line-height: 1.5;
      color: var(--fg-primary-color);
      font-weight: 500;
      margin: 0 0 8px 0;
    }

    .highlight-translation {
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      margin: 0;
    }
  }

  .highlight-note {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 8px;
    font-size: 0.9rem;
    color: var(--fg-accent-color);
    background-color: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.05);
    padding: 8px 12px;
    border-radius: 6px;

    .note-icon {
      margin-top: 2px;
      flex-shrink: 0;
    }

    .text {
      margin: 0;
    }
  }

  .highlight-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border-secondary-color);
    padding-top: 10px;

    .highlight-info {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 0.8rem;
      color: var(--fg-muted-color);

      .chapter-badge,
      .page-badge,
      .date-badge {
        background-color: var(--bg-tertiary-color);
        padding: 2px 6px;
        border-radius: 4px;
      }
    }

    .highlight-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}
</style>
