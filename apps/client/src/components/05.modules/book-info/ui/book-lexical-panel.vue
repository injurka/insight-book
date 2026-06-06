<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '~/components/05.modules/library/store/library.store'
import { useAnalysisStore } from '~/shared/store/analysis.store'
import { useBookLexicalStats } from '../composables/use-book-lexical-stats'

const { t } = useI18n()
const libraryStore = useLibraryStore()
const analysisStore = useAnalysisStore()

const isLexicalExpanded = ref(false)
const lexicalActiveTab = ref<'core' | 'entities' | 'rare'>('core')

const { isLegacyLexical, legacyTopWords, lexData, posStats } = useBookLexicalStats()

function handleWordClick(word: string, pos: string, event: MouseEvent) {
  const target = event.currentTarget as HTMLElement
  analysisStore.lookupStandaloneWord(word, pos || 'x', target)
}
</script>

<template>
  <div v-if="libraryStore.isAnalyzingVocab" class="ai-analysis-box is-loading">
    <Icon icon="mdi:loading" class="spin-icon" />
    <p>{{ t('bookLexical.analyzingVocab') }}</p>
    <p class="sub-text">
      {{ t('bookLexical.tokenizationInfo') }}
    </p>
  </div>

  <div v-else-if="libraryStore.currentBookInfo?.stats?.topWords" class="ai-analysis-box lexical-box">
    <div class="box-header expandable-header" @click="isLexicalExpanded = !isLexicalExpanded">
      <div class="header-info">
        <h3><Icon icon="mdi:chart-arc" /> {{ t('bookLexical.lexicalProfile') }}</h3>
        <span class="diversity-inline">
          <span class="dot-divider">•</span>
          {{ t('bookLexical.diversity') }} <b class="diversity-value">{{ libraryStore.currentBookInfo.stats.lexicalDiversity }}%</b>
        </span>
      </div>
      <Icon :icon="isLexicalExpanded ? 'mdi:chevron-up' : 'mdi:chevron-down'" class="header-chevron" />
    </div>

    <div v-show="isLexicalExpanded" class="lexical-expanded-content">
      <p class="lexical-description">
        {{ t('bookLexical.diversityDesc') }}
        <b>{{ t('bookLexical.clickToTranslate') }}</b>
      </p>

      <div v-if="posStats" class="pos-container">
        <div class="pos-labels">
          <span class="noun-dot">{{ t('bookLexical.nouns') }} {{ posStats.nouns }}%</span>
          <span class="verb-dot">{{ t('bookLexical.verbs') }} {{ posStats.verbs }}%</span>
          <span class="adj-dot">{{ t('bookLexical.adjectives') }} {{ posStats.adjs }}%</span>
        </div>
        <div class="pos-bar">
          <div class="pos-segment noun" :style="{ width: `${posStats.nouns}%` }" />
          <div class="pos-segment verb" :style="{ width: `${posStats.verbs}%` }" />
          <div class="pos-segment adj" :style="{ width: `${posStats.adjs}%` }" />
        </div>
      </div>

      <template v-if="isLegacyLexical">
        <h4 class="top-words-title">
          {{ t('bookLexical.topWords') }}
        </h4>
        <div class="top-words-cloud">
          <div
            v-for="word in legacyTopWords"
            :key="word.word"
            class="word-chip"
            :class="{
              'chip-n': word.pos.startsWith('n'),
              'chip-v': word.pos.startsWith('v'),
              'chip-a': word.pos.startsWith('a') || word.pos.startsWith('d'),
            }"
            @click.stop="handleWordClick(word.word, word.pos, $event)"
          >
            {{ word.word }} <span class="count">{{ word.count }}</span>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="lexical-tabs-nav">
          <button :class="{ active: lexicalActiveTab === 'core' }" @click="lexicalActiveTab = 'core'">
            <Icon icon="mdi:bullseye-arrow" /> {{ t('bookLexical.core') }}
          </button>
          <button :class="{ active: lexicalActiveTab === 'entities' }" @click="lexicalActiveTab = 'entities'">
            <Icon icon="mdi:account-group-outline" /> {{ t('bookLexical.names') }}
          </button>
          <button :class="{ active: lexicalActiveTab === 'rare' }" @click="lexicalActiveTab = 'rare'">
            <Icon icon="mdi:diamond-stone" /> {{ t('bookLexical.nuggets') }}
          </button>
        </div>

        <div class="lexical-tab-content">
          <div v-show="lexicalActiveTab === 'core'" class="tab-pane">
            <div class="word-group">
              <h5><Icon icon="mdi:shape-outline" /> {{ t('bookLexical.nouns') }} <span>{{ t('bookLexical.themes') }}</span></h5>
              <div class="top-words-cloud">
                <div
                  v-for="w in lexData?.nouns"
                  :key="w.word"
                  class="word-chip chip-n"
                  @click.stop="handleWordClick(w.word, w.pos, $event)"
                >
                  {{ w.word }} <span class="count">{{ w.count }}</span>
                </div>
              </div>
            </div>
            <div class="word-group">
              <h5><Icon icon="mdi:run-fast" /> {{ t('bookLexical.verbs') }} <span>{{ t('bookLexical.dynamics') }}</span></h5>
              <div class="top-words-cloud">
                <div
                  v-for="w in lexData?.verbs"
                  :key="w.word"
                  class="word-chip chip-v"
                  @click.stop="handleWordClick(w.word, w.pos, $event)"
                >
                  {{ w.word }} <span class="count">{{ w.count }}</span>
                </div>
              </div>
            </div>
            <div class="word-group">
              <h5><Icon icon="mdi:weather-partly-cloudy" /> {{ t('bookLexical.adjectives') }} <span>{{ t('bookLexical.atmosphere') }}</span></h5>
              <div class="top-words-cloud">
                <div
                  v-for="w in lexData?.adjs"
                  :key="w.word"
                  class="word-chip chip-a"
                  @click.stop="handleWordClick(w.word, w.pos, $event)"
                >
                  {{ w.word }} <span class="count">{{ w.count }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-show="lexicalActiveTab === 'entities'" class="tab-pane">
            <p class="tab-desc">
              {{ t('bookLexical.namesDesc') }}
            </p>
            <div class="top-words-cloud">
              <div
                v-for="w in lexData?.properNouns"
                :key="w.word"
                class="word-chip chip-entity"
                @click.stop="handleWordClick(w.word, w.pos, $event)"
              >
                {{ w.word }} <span class="count">{{ w.count }}</span>
              </div>
              <div v-if="!lexData?.properNouns?.length" class="empty-state-text">
                {{ t('bookLexical.noNamesFound') }}
              </div>
            </div>
          </div>

          <div v-show="lexicalActiveTab === 'rare'" class="tab-pane">
            <p class="tab-desc">
              {{ t('bookLexical.rareDesc') }}
            </p>
            <div class="top-words-cloud">
              <div
                v-for="w in lexData?.rareWords"
                :key="w.word"
                class="word-chip chip-rare"
                @click.stop="handleWordClick(w.word, w.pos, $event)"
              >
                {{ w.word }} <span class="count">{{ w.count }}</span>
              </div>
              <div v-if="!lexData?.rareWords?.length" class="empty-state-text">
                {{ t('bookLexical.noRareFound') }}
              </div>
            </div>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  margin-bottom: 0 !important;
  &:hover {
    .header-info h3 {
      color: var(--fg-accent-color);
    }
  }
  .header-info {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    h3 {
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
.lexical-description {
  font-size: 0.85rem;
  color: var(--fg-secondary-color);
  margin: 0 0 20px 0;
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
.top-words-title {
  margin: 0 0 12px 0;
  font-size: 1.1rem;
  color: var(--fg-primary-color);
}
.top-words-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  .word-chip {
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-primary-color);
    color: var(--fg-primary-color);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    .count {
      font-size: 0.75rem;
      background-color: var(--bg-tertiary-color);
      padding: 2px 6px;
      border-radius: 10px;
      color: var(--fg-secondary-color);
    }
    &.chip-n {
      border-color: #3b82f6;
    }
    &.chip-v {
      border-color: #ef4444;
    }
    &.chip-a {
      border-color: #10b981;
    }
    &.chip-entity {
      border-color: #8b5cf6;
      color: #8b5cf6;
      background-color: rgba(139, 92, 246, 0.05);
    }
    &.chip-rare {
      border-color: #f59e0b;
      background-color: rgba(245, 158, 11, 0.05);
      font-style: italic;
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
.chip-entity {
  border-color: #8b5cf6 !important;
  color: #8b5cf6 !important;
  background-color: rgba(139, 92, 246, 0.05) !important;
}
.chip-rare {
  border-color: #f59e0b !important;
  background-color: rgba(245, 158, 11, 0.05) !important;
  font-style: italic;
}
.empty-state-text {
  font-size: 0.9rem;
  color: var(--fg-muted-color);
  font-style: italic;
  padding: 12px 0;
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
