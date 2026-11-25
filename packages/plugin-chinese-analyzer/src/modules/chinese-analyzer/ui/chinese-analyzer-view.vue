<script setup lang="ts">
import type { AnalysisHistoryItem, LexemeToken } from '../model'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitActivityLoader } from '~/02.kit/molecules/kit-activity-loader/ui'
import { useAnalyzerTts } from '../composables/use-analyzer-tts'
import { useSentenceAnalyzer } from '../composables/use-sentence-analyzer'
import AlternativesSection from './partials/alternatives-section.vue'
import AnalyzerHeroInput from './partials/analyzer-hero-input.vue'
import AnalyzerHistoryDrawer from './partials/analyzer-history-drawer.vue'
import CachedChineseEntry from './partials/cached-chinese-entry.vue'
import GrammarPatternsSection from './partials/grammar-patterns-section.vue'
import NodeInspectorPanel from './partials/node-inspector-panel.vue'
import PhoneticsToneFlowCard from './partials/phonetics-tone-flow-card.vue'
import SentenceInteractiveCanvas from './partials/sentence-interactive-canvas.vue'
import SentenceOverviewCard from './partials/sentence-overview-card.vue'
import SentenceSwitcher from './partials/sentence-switcher.vue'
import UsagePragmaticsCard from './partials/usage-pragmatics-card.vue'

interface Props {
  initialSentence?: string
}

const props = defineProps<Props>()

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const analyzer = useSentenceAnalyzer()
const tts = useAnalyzerTts()
const page = useTemplateRef<HTMLElement>('pageRef')

const { currentAnalysis, viewAnalysis } = analyzer
const isHistoryOpen = ref(false)

const loadingAudioText = computed(() => tts.isLoadingAudio.value ? tts.activeText.value : null)
const cachePreviewText = computed(() => {
  if (analyzer.detectedLanguage.value !== 'zh')
    return ''

  const input = analyzer.queryInput.value.trim()
  const analysis = currentAnalysis.value?.sentence

  return input === analysis?.originalInput || input === analysis?.hanzi ? '' : input
})

function onSelectTokenFromOverview(token: LexemeToken): void {
  analyzer.selectNode({ kind: 'token', token })
}
async function scrollToPageStart(): Promise<void> {
  await nextTick()
  page.value?.scrollIntoView({ block: 'start' })
}
function onSelectHistoryItem(item: AnalysisHistoryItem): void {
  analyzer.loadFromHistory(item.analysis, item.query)
  void scrollToPageStart()
}
async function analyzeAndScroll(text?: string): Promise<void> {
  const pending = analyzer.analyzeSentence(text)

  if (analyzer.isAnalyzing.value)
    await scrollToPageStart()

  if (await pending)
    await scrollToPageStart()
}

onMounted(() => {
  const initialQuery = props.initialSentence ?? (typeof route?.query?.q === 'string' ? route.query.q.trim() : '')

  if (initialQuery) {
    void analyzeAndScroll(initialQuery)
  }
})
onUnmounted(() => {
  tts.stopAudio()
})
</script>

<template>
  <div ref="pageRef" class="chinese-analyzer-page" :class="{ 'is-embedded': props.initialSentence !== undefined }">
    <!-- Top Page Header -->
    <header v-if="props.initialSentence === undefined" class="page-header">
      <div class="header-left">
        <KitBtn
          icon="mdi:arrow-left"
          variant="text"
          size="md"
          class="back-btn"
          @click="router.back()"
        />
        <div class="header-titles">
          <h1 class="page-title">
            {{ t('plugins.chinese-analyzer.pageTitle') }}
          </h1>
        </div>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="history-trigger-btn"
          :aria-label="t('plugins.chinese-analyzer.historyBtn')"
          :title="t('plugins.chinese-analyzer.historyBtn')"
          @click="isHistoryOpen = true"
        >
          <Icon icon="mdi:history" />
          <span class="history-label">{{ t('plugins.chinese-analyzer.historyBtn') }}</span>
          <span v-if="analyzer.history.historyItems.value.length > 0" class="history-count">
            {{ analyzer.history.historyItems.value.length }}
          </span>
        </button>
      </div>
    </header>

    <!-- Stylized Bilingual Input Bar -->
    <AnalyzerHeroInput
      v-if="props.initialSentence === undefined"
      v-model="analyzer.queryInput.value"
      :is-analyzing="analyzer.isAnalyzing.value"
      :detected-language="analyzer.detectedLanguage.value"
      @analyze="analyzeAndScroll"
    >
      <template v-if="cachePreviewText" #lookup>
        <CachedChineseEntry :text="cachePreviewText" compact />
      </template>
    </AnalyzerHeroInput>

    <KitActivityLoader
      v-if="analyzer.isAnalyzing.value"
      icon="mdi:translate"
      :title="t('plugins.chinese-analyzer.loadingTitle')"
      :description="t('plugins.chinese-analyzer.loadingDescription')"
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
        @click="analyzeAndScroll()"
      >
        <Icon icon="mdi:refresh" />
        <span>{{ t('plugins.chinese-analyzer.retryBtn') }}</span>
      </button>
    </div>

    <!-- Main Analysis Content -->
    <div v-if="viewAnalysis" v-show="!analyzer.isAnalyzing.value" class="analysis-content">
      <!-- 0. Sentence Switcher (only for multi-sentence input) -->
      <SentenceSwitcher
        v-if="analyzer.sentenceTabs.value.length > 0"
        :model-value="analyzer.activeSentenceIndex.value"
        :tabs="analyzer.sentenceTabs.value"
        @update:model-value="analyzer.focusSentence"
      />

      <!-- 1. Sentence Overview & Ruby Ribbon -->
      <SentenceOverviewCard
        :sentence="viewAnalysis.sentence"
        :tokens="viewAnalysis.tokens"
        :selected-node="analyzer.selectedNode.value"
        :is-playing-audio="tts.activeText.value === viewAnalysis.sentence.hanzi.trim() && tts.isPlaying.value"
        :loading-audio-text="loadingAudioText"
        @select-token="onSelectTokenFromOverview"
        @speak="tts.speakChinese"
      />

      <!-- 2. Interactive Canvas + Deep Node Inspector Split -->
      <div class="canvas-inspector-layout analysis-section-divider">
        <div class="canvas-col">
          <SentenceInteractiveCanvas
            v-model:view-mode="analyzer.canvasViewMode.value"
            :analysis="viewAnalysis"
            :selected-node="analyzer.selectedNode.value"
            :expanded-token-ids="analyzer.expandedTokenIds.value"
            :are-all-tokens-expanded="analyzer.areAllTokensExpanded.value"
            @select-node="analyzer.selectNode"
            @toggle-token-expand="analyzer.toggleTokenExpand"
            @toggle-expand-all="analyzer.toggleExpandAllTokens"
            @speak="tts.speakChinese"
          />
        </div>

        <div class="inspector-col">
          <NodeInspectorPanel
            :selected-node="analyzer.selectedNode.value"
            :all-tokens="viewAnalysis.tokens"
            :loading-audio-text="loadingAudioText"
            @select-node="analyzer.selectNode"
            @speak="tts.speakChinese"
            @analyze-query="analyzeAndScroll"
          />
        </div>
      </div>

      <!-- 3. Phonetics, Rhythm & Visual Pitch Contour -->
      <PhoneticsToneFlowCard
        class="analysis-section-divider"
        :phonetics="viewAnalysis.phonetics"
        :hanzi="viewAnalysis.sentence.hanzi"
        :loading-audio-text="loadingAudioText"
        @speak="tts.speakChinese"
      />

      <!-- 4. Grammar Patterns & Constructions -->
      <GrammarPatternsSection
        v-if="viewAnalysis.grammarPatterns.length > 0"
        class="analysis-section-divider"
        :patterns="viewAnalysis.grammarPatterns"
        :loading-audio-text="loadingAudioText"
        @speak="tts.speakChinese"
        @analyze-query="analyzeAndScroll"
      />

      <!-- 5. Pragmatics & Usage Context + 6. Alternatives -->
      <UsagePragmaticsCard
        class="analysis-section-divider"
        :usage-context="viewAnalysis.usageContext"
      />

      <AlternativesSection
        v-if="viewAnalysis.alternatives.length > 0"
        class="analysis-section-divider"
        :alternatives="viewAnalysis.alternatives"
        :loading-audio-text="loadingAudioText"
        @speak="tts.speakChinese"
        @analyze-variant="analyzeAndScroll"
      />
    </div>

    <p v-if="tts.isAudioUnavailable.value" role="status" class="audio-cache-status">
      {{ t('plugins.chinese-analyzer.audioUnavailable') }}
    </p>

    <!-- History Modal -->
    <AnalyzerHistoryDrawer
      v-if="props.initialSentence === undefined"
      v-model:visible="isHistoryOpen"
      :items="analyzer.history.historyItems.value"
      :active-hanzi="currentAnalysis?.sentence.hanzi ?? ''"
      @select="onSelectHistoryItem"
      @remove="analyzer.history.removeHistoryItem"
      @clear="analyzer.history.clearHistory"
    />
  </div>
</template>

<style lang="scss" scoped>
.chinese-analyzer-page.is-embedded {
  padding: 0;
}

.audio-cache-status {
  position: fixed;
  z-index: 1201;
  inset-inline: 16px;
  bottom: calc(16px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  width: fit-content;
  max-width: min(30rem, calc(100% - 32px));
  margin: 0 auto;
  padding: 10px 14px;
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-size: 0.875rem;
  text-align: center;
  pointer-events: none;
}

.chinese-analyzer-page {
  max-width: 1360px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
  box-sizing: border-box;
  padding-left: var(--analyzer-padding-left);
  padding-right: var(--analyzer-padding-right);
  padding-top: calc(16px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
  padding-bottom: calc(44px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  --analyzer-padding-left: max(18px, env(safe-area-inset-left, 0px));
  --analyzer-padding-right: max(18px, env(safe-area-inset-right, 0px));

  @include media-down(md) {
    gap: 16px;
    --analyzer-padding-left: max(12px, env(safe-area-inset-left, 0px));
    --analyzer-padding-right: max(12px, env(safe-area-inset-right, 0px));
  }

  @include media-down(sm) {
    gap: 14px;
    padding-top: calc(10px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
    padding-bottom: calc(28px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
    --analyzer-padding-left: max(10px, env(safe-area-inset-left, 0px));
    --analyzer-padding-right: max(10px, env(safe-area-inset-right, 0px));
  }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  @include media-down(sm) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
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
}

.history-trigger-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid var(--border-secondary-color);
  background: transparent;
  color: var(--fg-secondary-color);
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
    background: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
  }

  @include media-down(sm) {
    height: 32px;
    padding: 0 10px;
    border-radius: 9px;
    font-size: 0.76rem;
    gap: 5px;

    .history-label {
      display: none;
    }
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
  --analysis-section-gap: 22px;

  gap: var(--analysis-section-gap);

  @include media-down(sm) {
    --analysis-section-gap: 16px;
  }
}

.canvas-inspector-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 390px;
  gap: 20px;
  align-items: start;

  @include media-down(lg) {
    grid-template-columns: minmax(0, 1fr);
  }

  @include media-down(sm) {
    gap: 14px;
  }
}

.inspector-col {
  min-width: 0;
  position: sticky;
  top: 16px;

  @include media-down(lg) {
    position: static;
  }
}

.analysis-section-divider {
  @include analyzer-section-divider;
}
</style>
