<script setup lang="ts">
import type { AnalysisHistoryItem } from '~/shared/store/books.store'
import { Icon } from '@iconify/vue'
import { onUnmounted, ref, watch } from 'vue'
import { KitDialog, KitSkeleton } from '~/components/01.kit'
import { useBooksStore } from '~/shared/store/books.store'

const store = useBooksStore()

const isPinned = ref(true)
const showHistory = ref(false)
const isSpeaking = ref(false)

watch(() => store.sidebarSentence, () => {
  showHistory.value = false
  if (isSpeaking.value) {
    window.speechSynthesis.cancel()
    isSpeaking.value = false
  }
})

watch(() => store.sidebarOpen, (isOpen) => {
  if (!isOpen && isSpeaking.value) {
    window.speechSynthesis.cancel()
    isSpeaking.value = false
  }
})

function loadHistoryItem(item: AnalysisHistoryItem) {
  store.handleSentenceAnalysis(item.sentence)
  showHistory.value = false
}

function playTTS() {
  if (!store.sidebarSentence)
    return

  const text = store.sidebarSentence
  const lang = store.currentBook?.language || 'en'

  const langMap: Record<string, string> = {
    zh: 'zh-CN',
    ja: 'ja-JP',
    en: 'en-US',
    ru: 'ru-RU',
  }

  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = langMap[lang.toLowerCase()] || lang
  utterance.rate = 0.9

  utterance.onstart = () => {
    isSpeaking.value = true
  }

  utterance.onend = () => {
    isSpeaking.value = false
  }

  window.speechSynthesis.speak(utterance)
}

onUnmounted(() => {
  window.speechSynthesis.cancel()
})
</script>

<template>
  <KitDialog
    v-model:visible="store.sidebarOpen"
    :title="showHistory ? 'История сессии' : 'Анализ ИИ'"
    :max-width="650"
    icon="mdi:robot-outline"
    :floating="!isPinned"
    :persistent="!isPinned"
  >
    <template #header-actions>
      <button
        class="dialog-icon-btn"
        :class="{ 'is-active': showHistory }"
        title="История сессии"
        @click="showHistory = !showHistory"
      >
        <Icon icon="mdi:history" />
      </button>
      <button
        class="dialog-icon-btn"
        :class="{ 'is-active': !isPinned }"
        :title="isPinned ? 'Открепить (свободное перемещение)' : 'Закрепить окно'"
        @click="isPinned = !isPinned"
      >
        <Icon :icon="isPinned ? 'mdi:pin' : 'mdi:pin-off-outline'" />
      </button>
    </template>

    <div v-if="showHistory" class="history-content">
      <div v-if="store.analysisHistory.length === 0" class="empty-history">
        Вы еще не анализировали предложения в этой сессии.
      </div>
      <div v-else class="history-list">
        <div
          v-for="(item, idx) in store.analysisHistory"
          :key="idx"
          class="history-card"
          @click="loadHistoryItem(item)"
        >
          <div class="history-sentence">
            {{ item.sentence }}
          </div>
          <div class="history-translation">
            {{ item.analysis.translation }}
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div v-if="store.isAnalyzing" class="analysis-loading">
        <KitSkeleton width="100%" height="20px" class="mb-3" />
        <KitSkeleton width="80%" height="20px" class="mb-3" />
        <KitSkeleton width="90%" height="20px" />
        <p class="loading-text">
          Анализ...
        </p>
      </div>

      <div v-else-if="store.sidebarAnalysis" class="analysis-content">
        <div class="sentence-header">
          <div class="original-sentence">
            {{ store.sidebarSentence }}
          </div>
          <button class="tts-btn" title="Озвучить" @click="playTTS">
            <Icon :icon="isSpeaking ? 'mdi:volume-high' : 'mdi:volume-medium'" :class="{ 'pulse-animation': isSpeaking }" />
          </button>
        </div>

        <div class="analysis-block">
          <h3><Icon icon="mdi:translate" class="inline-icon" /> Перевод</h3>
          <p class="translation-text">
            {{ store.sidebarAnalysis.translation }}
          </p>
        </div>

        <div v-if="store.sidebarAnalysis.grammarRules?.length" class="analysis-block">
          <h3><Icon icon="mdi:puzzle-outline" class="inline-icon" /> Грамматика</h3>
          <div v-for="(rule, idx) in store.sidebarAnalysis.grammarRules" :key="idx" class="grammar-card">
            <div class="rule-pattern">
              {{ rule.pattern }}
            </div>
            <div class="rule-exp">
              {{ rule.explanation }}
            </div>
            <div v-if="rule.example" class="rule-ex">
              Пример: {{ rule.example }}
            </div>
          </div>
        </div>

        <div v-if="store.sidebarAnalysis.vocabulary?.length" class="analysis-block">
          <h3><Icon icon="mdi:book-open-page-variant-outline" class="inline-icon" /> Лексика</h3>
          <ul class="vocab-list">
            <li v-for="(v, idx) in store.sidebarAnalysis.vocabulary" :key="idx">
              <div class="vocab-word">
                <span class="dict-word">{{ v.word }}</span>
                <span class="dict-transcription">{{ v.transcription }}</span>
              </div>
              <div class="vocab-meaning">
                {{ v.meaning }}
              </div>
              <div v-if="v.usageInContext" class="vocab-context">
                Контекст: {{ v.usageInContext }}
              </div>
            </li>
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

      .pulse-animation {
        animation: pulse-op 1.5s infinite;
      }
    }

    .original-sentence {
      flex-grow: 1;
      margin-bottom: 0;
    }
  }

  .original-sentence {
    font-size: 1.3rem;
    font-weight: 500;
    margin-bottom: 24px;
    padding: 10px 16px;
    background-color: var(--bg-tertiary-color);
    border-left: 4px solid var(--fg-accent-color);
    border-radius: 4px 8px 8px 4px;
    font-family: inherit;
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

@keyframes pulse-op {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
