<script setup lang="ts">
import type { AnalysisHistoryItem } from '~/shared/store/analysis.store'
import { Icon } from '@iconify/vue'
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitDialog, KitSkeleton, KitTooltip } from '~/components/01.kit'
import { useTts } from '~/shared/composables/use-tts'
import { useAnalysisStore } from '~/shared/store/analysis.store'

const { t } = useI18n()
const analysisStore = useAnalysisStore()
const { speak, stop, isPlaying, isLoading } = useTts()

const isPinned = ref(true)
const showHistory = ref(false)

watch(() => analysisStore.sidebarSentence, () => {
  showHistory.value = false
  if (isPlaying.value || isLoading.value) {
    stop()
  }
})

watch(() => analysisStore.sidebarOpen, (isOpen) => {
  if (!isOpen && (isPlaying.value || isLoading.value)) {
    stop()
  }
})

function loadHistoryItem(item: AnalysisHistoryItem) {
  analysisStore.handleSentenceAnalysis(item.sentence)
  showHistory.value = false
}

function playTTS() {
  if (!analysisStore.sidebarSentence)
    return

  if (isPlaying.value || isLoading.value) {
    stop()
  }
  else {
    speak(analysisStore.sidebarSentence)
  }
}

onUnmounted(() => stop())
</script>

<template>
  <KitDialog
    v-model:visible="analysisStore.sidebarOpen"
    :title="showHistory ? t('analysis.sessionHistory') : t('analysis.aiAnalysis')"
    :max-width="650"
    icon="mdi:robot-outline"
    :floating="!isPinned"
    :persistent="!isPinned"
    :key-trigger="analysisStore.sidebarSentence"
  >
    <template #header-actions>
      <KitTooltip :text="showHistory ? t('analysis.hideHistory') : t('analysis.sessionHistory')" placement="bottom">
        <button
          class="dialog-icon-btn"
          :class="{ 'is-active': showHistory }"
          @click="showHistory = !showHistory"
        >
          <Icon icon="mdi:history" />
        </button>
      </KitTooltip>
      <KitTooltip :text="isPinned ? t('analysis.unpin') : t('analysis.pin')" placement="bottom-end">
        <button
          class="dialog-icon-btn pin-btn"
          :class="{ 'is-active': !isPinned }"
          @click="isPinned = !isPinned"
        >
          <Icon :icon="isPinned ? 'mdi:pin' : 'mdi:pin-off-outline'" />
        </button>
      </KitTooltip>
    </template>

    <div v-if="showHistory" class="history-content">
      <div v-if="analysisStore.analysisHistory.length === 0" class="empty-history">
        {{ t('analysis.noSentencesAnalyzed') }}
      </div>
      <div v-else class="history-list">
        <div
          v-for="(item, idx) in analysisStore.analysisHistory"
          :key="idx"
          class="history-card"
          @click="loadHistoryItem(item)"
        >
          <div class="history-sentence">
            {{ item.sentence }}
          </div>
          <div v-if="item.analysis.transcription" class="history-transcription">
            {{ item.analysis.transcription }}
          </div>
          <div class="history-translation">
            {{ item.analysis.translation }}
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div v-if="analysisStore.isAnalyzing" class="analysis-loading">
        <KitSkeleton width="100%" height="20px" class="mb-3" />
        <KitSkeleton width="80%" height="20px" class="mb-3" />
        <KitSkeleton width="90%" height="20px" />
        <p class="loading-text">
          {{ t('analysis.analyzing') }}
        </p>
      </div>

      <div v-else-if="analysisStore.sidebarAnalysis" class="analysis-content">
        <div class="sentence-header">
          <div class="sentence-content js-tooltip-selectable">
            <div class="original-sentence">
              {{ analysisStore.sidebarSentence }}
            </div>
            <div v-if="analysisStore.sidebarAnalysis.transcription" class="sentence-transcription">
              {{ analysisStore.sidebarAnalysis.transcription }}
            </div>
          </div>
          <KitTooltip :text="t('analysis.voice')" placement="top-end">
            <button class="tts-btn" @click="playTTS">
              <Icon
                :icon="isLoading ? 'mdi:loading' : (isPlaying ? 'mdi:volume-high' : 'mdi:volume-medium')"
                :class="{ 'pulse-animation': isPlaying, 'spin-animation': isLoading }"
              />
            </button>
          </KitTooltip>
        </div>

        <div class="analysis-block">
          <h3><Icon icon="mdi:translate" class="inline-icon" /> {{ t('analysis.translation') }}</h3>
          <p class="translation-text">
            {{ analysisStore.sidebarAnalysis.translation }}
          </p>
        </div>

        <div v-if="analysisStore.sidebarAnalysis.grammarRules?.length" class="analysis-block">
          <h3><Icon icon="mdi:puzzle-outline" class="inline-icon" /> {{ t('analysis.grammar') }}</h3>
          <div v-for="(rule, idx) in analysisStore.sidebarAnalysis.grammarRules" :key="idx" class="grammar-card">
            <div class="rule-pattern">
              {{ rule.pattern }}
            </div>
            <div class="rule-exp">
              {{ rule.explanation }}
            </div>
            <div v-if="rule.example" class="rule-ex">
              {{ t('analysis.example') }}: {{ rule.example }}
            </div>
          </div>
        </div>

        <div v-if="analysisStore.sidebarAnalysis.vocabulary?.length" class="analysis-block">
          <h3><Icon icon="mdi:book-open-page-variant-outline" class="inline-icon" /> {{ t('analysis.vocabulary') }}</h3>
          <ul class="vocab-list">
            <template v-for="(v, idx) in analysisStore.sidebarAnalysis.vocabulary" :key="idx">
              <li v-if="v && v.word">
                <div class="vocab-word">
                  <span class="dict-word">{{ v.word }}</span>
                  <span v-if="v.transcription" class="dict-transcription">{{ v.transcription }}</span>
                </div>
                <div class="vocab-meaning">
                  {{ v.meaning }}
                </div>
                <div v-if="v.usageInContext" class="vocab-context">
                  {{ t('analysis.context') }}: {{ v.usageInContext }}
                </div>
              </li>
            </template>
          </ul>
        </div>
      </div>
    </template>
  </KitDialog>
</template>

<style lang="scss" scoped>
.history-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty-history {
  text-align: center;
  color: var(--fg-secondary-color);
  padding: 32px 0;
  font-style: italic;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-card {
  padding: 12px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background-color 0.2s;
  &:hover {
    background-color: var(--bg-hover-color);
    border-color: var(--fg-accent-color);
  }
  .history-sentence {
    font-size: 1.05rem;
    font-weight: 500;
    color: var(--fg-primary-color);
    margin-bottom: 4px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .history-transcription {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
    margin-bottom: 4px;
    font-style: italic;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .history-translation {
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
.analysis-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px 0;
  text-align: center;
  .loading-text {
    margin-top: 16px;
    color: var(--fg-secondary-color);
    font-style: italic;
  }
}
.analysis-content {
  .sentence-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 24px;
    .tts-btn {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 49px;
      height: 49px;
      border-radius: 8px;
      background-color: var(--bg-tertiary-color);
      border: 1px solid var(--border-secondary-color);
      color: var(--fg-accent-color);
      font-size: 1.5rem;
      cursor: pointer;
      transition: all 0.2s;
      &:hover {
        background-color: var(--bg-hover-color);
        color: var(--fg-primary-color);
      }
    }
    .sentence-content {
      flex-grow: 1;
      padding: 10px 16px;
      background-color: var(--bg-tertiary-color);
      border-left: 4px solid var(--fg-accent-color);
      border-radius: 4px 8px 8px 4px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      .original-sentence {
        font-size: 1.3rem;
        font-weight: 500;
        margin: 0;
        font-family: inherit;
      }
      .sentence-transcription {
        font-size: 1.05rem;
        color: var(--fg-secondary-color);
        line-height: 1.4;
      }
    }
  }
  .analysis-block {
    margin-bottom: 24px;
    h3 {
      font-size: 1.1rem;
      margin-bottom: 12px;
      color: var(--fg-accent-color);
      display: flex;
      align-items: center;
      gap: 8px;
      .inline-icon {
        font-size: 1.3rem;
      }
    }
  }
  .translation-text {
    font-size: 1.05rem;
    line-height: 1.5;
  }
  .grammar-card {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 12px;
    .rule-pattern {
      font-weight: bold;
      color: var(--fg-primary-color);
      margin-bottom: 4px;
    }
    .rule-exp {
      font-size: 0.95rem;
      color: var(--fg-secondary-color);
      margin-bottom: 6px;
    }
    .rule-ex {
      font-size: 0.9rem;
      font-style: italic;
      color: var(--fg-muted-color);
    }
  }
  .vocab-list {
    list-style: none;
    padding: 0;
    margin: 0;
    li {
      padding: 12px 0;
      border-bottom: 1px dashed var(--border-secondary-color);
      &:last-child {
        border-bottom: none;
      }
      .vocab-word {
        margin-bottom: 4px;
      }
      .vocab-meaning {
        font-size: 0.95rem;
        margin-bottom: 4px;
      }
      .vocab-context {
        font-size: 0.85rem;
        color: var(--fg-secondary-color);
      }
    }
  }
}
.pulse-animation {
  animation: pulse-op 1.2s ease-in-out infinite;
  transform-origin: center;
  display: inline-block;
  color: var(--fg-accent-color);
}
.spin-animation {
  animation: spin 1s linear infinite;
  display: inline-block;
}
@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.85);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@include media-down(md) {
  .analysis-content {
    .sentence-header {
      gap: 4px;
      .tts-btn {
        width: 44px;
        height: 44px;
      }
    }
  }
}
@include media-down(sm) {
  .pin-btn {
    display: none !important;
  }
}
</style>
