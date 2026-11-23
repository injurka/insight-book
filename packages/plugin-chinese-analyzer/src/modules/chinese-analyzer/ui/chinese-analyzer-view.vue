<script setup lang="ts">
import type { AnalysisHistoryItem, LexemeToken } from '../model'
import { Icon } from '@iconify/vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { useAnalyzerTts } from '../composables/use-analyzer-tts'
import { useSentenceAnalyzer } from '../composables/use-sentence-analyzer'
import AlternativesSection from './partials/alternatives-section.vue'
import AnalyzerHeroInput from './partials/analyzer-hero-input.vue'
import AnalyzerHistoryDrawer from './partials/analyzer-history-drawer.vue'
import GrammarPatternsSection from './partials/grammar-patterns-section.vue'
import NodeInspectorPanel from './partials/node-inspector-panel.vue'
import PhoneticsToneFlowCard from './partials/phonetics-tone-flow-card.vue'
import SentenceInteractiveCanvas from './partials/sentence-interactive-canvas.vue'
import SentenceOverviewCard from './partials/sentence-overview-card.vue'
import UsagePragmaticsCard from './partials/usage-pragmatics-card.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const analyzer = useSentenceAnalyzer()
const tts = useAnalyzerTts()

const isHistoryOpen = ref(false)

function onSelectTokenFromOverview(token: LexemeToken): void {
  analyzer.selectNode({ kind: 'token', token })
}

function onSelectHistoryItem(item: AnalysisHistoryItem): void {
  analyzer.loadFromHistory(item.analysis, item.query)
}

function onAnalyzeSubQuery(text: string): void {
  void analyzer.analyzeSentence(text)
}

onMounted(() => {
  const initialQuery = typeof route?.query?.q === 'string' ? route.query.q.trim() : ''

  if (initialQuery) {
    void analyzer.analyzeSentence(initialQuery)
  }
})

onUnmounted(() => {
  tts.stopAudio()
})
</script>

<template>
  <div class="chinese-analyzer-page">
    <!-- Top Page Header -->
    <header class="page-header">
      <div class="header-left">
        <KitBtn
          icon="mdi:arrow-left"
          variant="text"
          size="md"
          class="back-btn"
          @click="router.back()"
        />
        <div class="header-titles">
          <div class="title-badge-row">
            <h1 class="page-title">
              {{ t('plugins.chinese-analyzer.pageTitle') }}
            </h1>
            <span class="ai-seal-badge">AI • 汉语解析</span>
          </div>
          <p class="page-subtitle">
            {{ t('plugins.chinese-analyzer.pageSubtitle') }}
          </p>
        </div>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="history-trigger-btn"
          @click="isHistoryOpen = true"
        >
          <Icon icon="mdi:history" />
          <span>{{ t('plugins.chinese-analyzer.historyBtn') }}</span>
          <span v-if="analyzer.history.historyItems.value.length > 0" class="history-count">
            {{ analyzer.history.historyItems.value.length }}
          </span>
        </button>
      </div>
    </header>

    <!-- Stylized Bilingual Input Bar -->
    <AnalyzerHeroInput
      v-model="analyzer.queryInput.value"
      :is-analyzing="analyzer.isAnalyzing.value"
      :detected-language="analyzer.detectedLanguage.value"
      @analyze="analyzer.analyzeSentence"
    />

    <!-- Error Alert -->
    <div v-if="analyzer.errorMessage.value" class="error-alert">
      <div class="err-content">
        <Icon icon="mdi:alert-circle-outline" class="err-icon" />
        <span>{{ analyzer.errorMessage.value }}</span>
      </div>
      <button
        type="button"
        class="err-retry-btn"
        @click="analyzer.analyzeSentence()"
      >
        <Icon icon="mdi:refresh" />
        <span>{{ t('plugins.chinese-analyzer.retryBtn') }}</span>
      </button>
    </div>

    <!-- Main Analysis Content -->
    <div class="analysis-content" :class="{ 'is-loading': analyzer.isAnalyzing.value }">
      <!-- 1. Sentence Overview & Ruby Ribbon -->
      <SentenceOverviewCard
        v-model:show-traditional="analyzer.showTraditional.value"
        :sentence="analyzer.currentAnalysis.value.sentence"
        :tokens="analyzer.currentAnalysis.value.tokens"
        :selected-node="analyzer.selectedNode.value"
        :is-playing-audio="tts.isPlaying.value"
        @select-token="onSelectTokenFromOverview"
        @speak="tts.speakChinese"
      />

      <!-- 2. Interactive Canvas + Deep Node Inspector Split -->
      <div class="canvas-inspector-layout">
        <div class="canvas-col">
          <SentenceInteractiveCanvas
            v-model:view-mode="analyzer.canvasViewMode.value"
            :analysis="analyzer.currentAnalysis.value"
            :selected-node="analyzer.selectedNode.value"
            :expanded-token-ids="analyzer.expandedTokenIds.value"
            :are-all-tokens-expanded="analyzer.areAllTokensExpanded.value"
            :show-traditional="analyzer.showTraditional.value"
            @select-node="analyzer.selectNode"
            @toggle-token-expand="analyzer.toggleTokenExpand"
            @toggle-expand-all="analyzer.toggleExpandAllTokens"
            @speak="tts.speakChinese"
          />
        </div>

        <div class="inspector-col">
          <NodeInspectorPanel
            :selected-node="analyzer.selectedNode.value"
            :all-tokens="analyzer.currentAnalysis.value.tokens"
            :show-traditional="analyzer.showTraditional.value"
            @select-node="analyzer.selectNode"
            @speak="tts.speakChinese"
            @analyze-query="onAnalyzeSubQuery"
          />
        </div>
      </div>

      <!-- 3. Phonetics, Rhythm & Visual Pitch Contour -->
      <PhoneticsToneFlowCard
        :phonetics="analyzer.currentAnalysis.value.phonetics"
        @speak="tts.speakChinese"
      />

      <!-- 4. Grammar Patterns & Constructions -->
      <GrammarPatternsSection
        v-if="analyzer.currentAnalysis.value.grammarPatterns.length > 0"
        :patterns="analyzer.currentAnalysis.value.grammarPatterns"
        @speak="tts.speakChinese"
        @analyze-query="onAnalyzeSubQuery"
      />

      <!-- 5. Pragmatics & Usage Context + 6. Alternatives -->
      <div class="bottom-dual-grid">
        <UsagePragmaticsCard
          :usage-context="analyzer.currentAnalysis.value.usageContext"
        />

        <AlternativesSection
          v-if="analyzer.currentAnalysis.value.alternatives.length > 0"
          :alternatives="analyzer.currentAnalysis.value.alternatives"
          @speak="tts.speakChinese"
          @analyze-variant="onAnalyzeSubQuery"
        />
      </div>
    </div>

    <!-- History Modal -->
    <AnalyzerHistoryDrawer
      v-model:visible="isHistoryOpen"
      :items="analyzer.history.historyItems.value"
      :active-hanzi="analyzer.currentAnalysis.value.sentence.hanzi"
      @select="onSelectHistoryItem"
      @remove="analyzer.history.removeHistoryItem"
      @clear="analyzer.history.clearHistory"
    />
  </div>
</template>

<style lang="scss" scoped>
.chinese-analyzer-page {
  max-width: 1360px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
  box-sizing: border-box;
  padding-top: calc(16px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
  padding-bottom: calc(44px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  padding-left: max(18px, env(safe-area-inset-left, 0px));
  padding-right: max(18px, env(safe-area-inset-right, 0px));

  @include media-down(md) {
    gap: 16px;
    padding-left: max(12px, env(safe-area-inset-left, 0px));
    padding-right: max(12px, env(safe-area-inset-right, 0px));
  }

  @include media-down(sm) {
    gap: 14px;
    padding-top: calc(10px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
    padding-bottom: calc(28px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
    padding-left: max(10px, env(safe-area-inset-left, 0px));
    padding-right: max(10px, env(safe-area-inset-right, 0px));
  }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  @include media-down(sm) {
    gap: 8px;
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  .back-btn {
    flex-shrink: 0;
  }

  @include media-down(sm) {
    gap: 8px;
  }
}

.header-titles {
  min-width: 0;

  .title-badge-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    @include media-down(sm) {
      gap: 6px;
    }
  }

  .page-title {
    margin: 0;
    font-size: 1.85rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    letter-spacing: -0.02em;

    @include media-down(sm) {
      font-size: 1.22rem;
    }
  }

  .ai-seal-badge {
    padding: 3px 10px;
    border-radius: 8px;
    font-size: 0.74rem;
    font-weight: 800;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
    border: 1px solid rgba(var(--fg-accent-color-rgb), 0.3);

    @include media-down(sm) {
      padding: 2px 7px;
      font-size: 0.66rem;
      border-radius: 6px;
    }
  }

  .page-subtitle {
    margin: 4px 0 0;
    font-size: 0.9rem;
    color: var(--fg-secondary-color);
    line-height: 1.4;

    @include media-down(sm) {
      margin: 2px 0 0;
      font-size: 0.76rem;
      line-height: 1.32;
    }
  }
}

.history-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border-primary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }

  .history-count {
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 0.72rem;
    background: var(--fg-accent-color);
    color: #ffffff;
  }

  @include media-down(sm) {
    height: 32px;
    padding: 0 10px;
    border-radius: 9px;
    font-size: 0.76rem;
    gap: 5px;
  }
}

.error-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  flex-wrap: wrap;

  .err-content {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
    font-weight: 600;
  }

  .err-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .err-retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 9px;
    border: 1px solid rgba(239, 68, 68, 0.4);
    background: var(--bg-primary-color);
    color: #ef4444;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }
}

.analysis-content {
  display: flex;
  flex-direction: column;
  gap: 22px;
  transition: opacity 0.25s ease;

  &.is-loading {
    opacity: 0.58;
    pointer-events: none;
  }

  @include media-down(sm) {
    gap: 16px;
  }
}

.canvas-inspector-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  gap: 20px;
  align-items: start;

  @include media-down(lg) {
    grid-template-columns: 1fr;
  }

  @include media-down(sm) {
    gap: 14px;
  }
}

.inspector-col {
  position: sticky;
  top: 16px;

  @include media-down(lg) {
    position: static;
  }
}

.bottom-dual-grid {
  display: flex;
  flex-direction: column;
  gap: 22px;

  @include media-down(sm) {
    gap: 16px;
  }
}
</style>
