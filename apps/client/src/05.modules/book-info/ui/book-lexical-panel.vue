<script setup lang="ts">
import type { LexicalWordData } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnalysisStore } from '~/01.shared/store/analysis/analysis.store'
import { useLibraryStore } from '~/05.modules/library/store/library.store'
import { useBookLexicalStats } from '../composables/use-book-lexical-stats'
import BookLexicalWords from './book-lexical-words.vue'

const { t, n } = useI18n()
const libraryStore = useLibraryStore()
const analysisStore = useAnalysisStore()
const { isLegacyLexical, legacyTopWords, lexData, posStats } = useBookLexicalStats()

const isLexicalExpanded = ref(false)
const lexicalActiveTab = ref('core')
const tabs = ['core', 'entities', 'rare', 'phrases'] as const
const tabLabels = { core: 'core', entities: 'names', rare: 'nuggets', phrases: 'phrases' }
const tabIcons = { core: 'mdi:bullseye-arrow', entities: 'mdi:account-group-outline', rare: 'mdi:diamond-stone', phrases: 'mdi:format-quote-close' }

const metrics = computed(() => lexData.value?.metrics)
const isCurrentProfile = computed(() => lexData.value?.version === 2)
const groups = computed(() => [
  { key: 'nouns', words: lexData.value?.nouns, tone: 'noun', hint: 'themes' },
  { key: 'verbs', words: lexData.value?.verbs, tone: 'verb', hint: 'dynamics' },
  { key: 'adjectives', words: lexData.value?.adjs, tone: 'adj', hint: 'atmosphere' },
])

function handleWordClick(word: LexicalWordData, event: MouseEvent) {
  analysisStore.lookupStandaloneWord(word.word, word.pos || 'x', event.currentTarget as HTMLElement)
}
</script>

<template>
  <div v-if="libraryStore.isAnalyzingVocab" class="ai-analysis-box is-loading" role="status">
    <Icon icon="mdi:loading" class="spin-icon" />
    <p>{{ t('bookLexical.analyzingVocab') }}</p>
    <p class="sub-text">
      {{ t('bookLexical.tokenizationInfo') }}
    </p>
  </div>
  <div v-else-if="libraryStore.currentBookInfo?.stats?.topWords" class="ai-analysis-box lexical-box">
    <button
      type="button"
      class="box-header expandable-header"
      :aria-expanded="isLexicalExpanded"
      @click="isLexicalExpanded = !isLexicalExpanded"
    >
      <span class="header-info">
        <span class="profile-title"><Icon icon="mdi:chart-arc" /> {{ t('bookLexical.lexicalProfile') }}</span>
        <span v-if="isCurrentProfile && metrics?.diversity != null" class="diversity-inline">
          <span class="dot-divider">•</span>
          {{ t('bookLexical.diversity') }} <b class="diversity-value">{{ metrics.diversity }}%</b>
        </span>
      </span>
      <Icon :icon="isLexicalExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="header-chevron" />
    </button>
    <div v-show="isLexicalExpanded" class="lexical-expanded-content">
      <dl v-if="metrics" class="profile-metrics">
        <div><dt>{{ t('bookLexical.tokenCount') }}</dt><dd>{{ n(metrics.tokens) }}</dd></div>
        <div><dt>{{ t('bookLexical.vocabulary') }}</dt><dd>{{ n(metrics.vocabulary) }}</dd></div>
        <div><dt>{{ t('bookLexical.contentCount') }}</dt><dd>{{ n(metrics.contentTokens) }}</dd></div>
      </dl>
      <p v-if="metrics && metrics.diversity == null" class="tab-desc">
        {{ t('bookLexical.shortSample') }}
      </p>
      <p v-if="metrics && !metrics.tagged" class="tab-desc">
        {{ t('bookLexical.untaggedLanguage') }}
      </p>
      <p class="tab-desc">
        {{ t('bookLexical.clickToTranslate') }} {{ t('bookLexical.countHint') }}
      </p>
      <div v-if="posStats && (!metrics || metrics.tagged)" class="pos-container">
        <div class="pos-labels">
          <span class="noun-dot">{{ t('bookLexical.nouns') }} {{ posStats.nouns }}%</span>
          <span class="verb-dot">{{ t('bookLexical.verbs') }} {{ posStats.verbs }}%</span>
          <span class="adj-dot">{{ t('bookLexical.adjectives') }} {{ posStats.adjs }}%</span>
          <span class="other-dot">{{ t('bookLexical.otherWords') }} {{ posStats.others }}%</span>
        </div>
        <div class="pos-bar">
          <div class="pos-segment noun" :style="{ width: `${posStats.nouns}%` }" />
          <div class="pos-segment verb" :style="{ width: `${posStats.verbs}%` }" />
          <div class="pos-segment adj" :style="{ width: `${posStats.adjs}%` }" />
        </div>
      </div>
      <BookLexicalWords v-if="isLegacyLexical" :words="legacyTopWords" @select="handleWordClick" />
      <template v-else>
        <div class="lexical-tabs-nav" :aria-label="t('bookLexical.lexicalProfile')">
          <button
            v-for="tab in tabs"
            v-show="tab !== 'phrases' || isCurrentProfile"
            :key="tab"
            type="button"
            :class="{ active: lexicalActiveTab === tab }"
            :aria-pressed="lexicalActiveTab === tab"
            @click="lexicalActiveTab = tab"
          >
            <Icon :icon="tabIcons[tab]" /> {{ t(`bookLexical.${tabLabels[tab]}`) }}
          </button>
        </div>
        <div class="lexical-tab-content">
          <div v-show="lexicalActiveTab === 'core'" class="tab-pane">
            <p class="tab-desc">
              {{ t('bookLexical.coreDesc') }}
            </p>
            <div
              v-for="group in groups"
              v-show="metrics?.tagged !== false"
              :key="group.key"
              class="word-group"
            >
              <h5>{{ t(`bookLexical.${group.key}`) }} <span>{{ t(`bookLexical.${group.hint}`) }}</span></h5>
              <BookLexicalWords :words="group.words" :tone="group.tone" @select="handleWordClick" />
            </div>
            <div v-if="lexData?.words?.length" class="word-group">
              <h5>{{ t('bookLexical.unclassified') }}</h5>
              <BookLexicalWords :words="lexData.words" @select="handleWordClick" />
            </div>
          </div>
          <div v-show="lexicalActiveTab === 'entities'" class="tab-pane">
            <p class="tab-desc">
              {{ t('bookLexical.namesDesc') }}
            </p>
            <BookLexicalWords :words="lexData?.properNouns" tone="entity" @select="handleWordClick" />
          </div>
          <div v-show="lexicalActiveTab === 'rare'" class="tab-pane">
            <p class="tab-desc">
              {{ t('bookLexical.rareDesc', { max: metrics?.rareLimit || 5 }) }}
            </p>
            <BookLexicalWords :words="lexData?.rareWords" tone="rare" @select="handleWordClick" />
          </div>
          <div v-show="lexicalActiveTab === 'phrases'" class="tab-pane">
            <p class="tab-desc">
              {{ t('bookLexical.phrasesDesc') }}
            </p>
            <BookLexicalWords :words="lexData?.phrases" @select="handleWordClick" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ai-analysis-box {
  border-radius: 12px;
  margin-bottom: 32px;
  &.lexical-box {
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    padding: 16px 24px;
    transition: border-color 0.2s;
    &:hover {
      border-color: var(--border-primary-color);
    }
  }
  &.is-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 40px 24px;
    background-color: rgba(var(--bg-accent-color-rgb, 48, 33, 61), 0.3);
    border: 1px solid var(--border-accent-color);
    .spin-icon {
      font-size: 3rem;
      color: var(--fg-accent-color);
      margin-bottom: 16px;
      animation: spin 1s linear infinite;
    }
    p {
      margin: 0 0 8px 0;
      font-size: 1.1rem;
      font-weight: 500;
    }
    .sub-text {
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
    }
  }
}
.expandable-header {
  width: 100%;
  background: transparent;
  border: 0;
  padding: 0;
  text-align: left;
  font: inherit;
  &:focus-visible {
    outline: 2px solid var(--fg-accent-color);
    outline-offset: 4px;
  }
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  margin-bottom: 0 !important;
  &:hover {
    .header-info .profile-title {
      color: var(--fg-accent-color);
    }
  }
  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    .profile-title {
      margin: 0;
      font-size: 1.2rem;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: color 0.2s;
      color: var(--fg-primary-color);
    }
  }
  .diversity-inline {
    font-size: 0.95rem;
    color: var(--fg-secondary-color);
    display: flex;
    align-items: center;
    gap: 8px;
    .dot-divider {
      opacity: 0.5;
      font-size: 1.2rem;
    }
    .diversity-value {
      color: var(--fg-accent-color);
      font-weight: 600;
      font-size: 1.05rem;
    }
  }
  .header-chevron {
    font-size: 1.5rem;
    color: var(--fg-secondary-color);
    transition: transform 0.3s;
  }
}
.lexical-expanded-content {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--border-secondary-color);
  animation: fade-in 0.3s ease;
}
.profile-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 32px;
  margin: 0 0 20px;
}
.profile-metrics dt {
  font-size: 0.8rem;
  color: var(--fg-secondary-color);
}
.profile-metrics dd {
  margin: 4px 0 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.pos-container {
  margin-bottom: 24px;
  .pos-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 8px;
    font-size: 0.85rem;
    font-weight: 500;
    @include media-down(sm) {
      gap: 8px 12px;
    }
    span {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      &::before {
        content: '';
        display: block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
    }
    .other-dot::before {
      background-color: var(--fg-secondary-color);
    }
    .noun-dot::before {
      background-color: #3b82f6;
    }
    .verb-dot::before {
      background-color: #ef4444;
    }
    .adj-dot::before {
      background-color: #10b981;
    }
  }
  .pos-bar {
    height: 10px;
    border-radius: 5px;
    display: flex;
    overflow: hidden;
    background-color: var(--bg-tertiary-color);
    .pos-segment {
      transition: width 0.5s ease-in-out;
    }
    .noun {
      background-color: #3b82f6;
    }
    .verb {
      background-color: #ef4444;
    }
    .adj {
      background-color: #10b981;
    }
  }
}
.lexical-tabs-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-secondary-color);
  padding-bottom: 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
  @include media-down(sm) {
    flex-wrap: wrap;
    overflow-x: visible;
  }
  button {
    border: 0;
    font-family: inherit;
    &:focus-visible {
      outline: 2px solid var(--fg-accent-color);
      outline-offset: 2px;
    }
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-secondary-color);
    background: transparent;
    transition: all 0.2s;
    white-space: nowrap;
    @include media-down(sm) {
      flex: 1 1 calc(50% - 8px);
    }
    &:hover {
      background: var(--bg-hover-color);
      color: var(--fg-primary-color);
    }
    &.active {
      background: rgba(var(--bg-accent-color-rgb, 201, 117, 222), 0.15);
      color: var(--fg-accent-color);
    }
    .badge {
      background: var(--fg-accent-color);
      color: var(--bg-primary-color);
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 99px;
      margin-left: 4px;
    }
  }
}
.tab-pane {
  animation: fade-in 0.3s ease;
}
.tab-desc {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  margin-bottom: 16px;
  line-height: 1.4;
}
.word-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0px;
  }

  h5 {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 1rem;
    margin: 0 0 12px 0;
    color: var(--fg-primary-color);

    span {
      font-weight: normal;
      font-size: 0.85rem;
      color: var(--fg-secondary-color);
    }
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
