<script setup lang="ts">
import type { CanvasSelectedNode, LexemeToken, SentenceOverview } from '../../model'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  groupTokensBySentence,
  splitFormulaIntoLines,
  splitTextIntoSentenceLines,
} from '../../../../shared/lib/sentence-segmentation'
import { getPosClass } from '../../../../shared/lib/tone-utils'

interface Props {
  sentence: SentenceOverview
  tokens: LexemeToken[]
  selectedNode: CanvasSelectedNode | null
  isPlayingAudio: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectToken: [token: LexemeToken]
  speak: [text: string]
}>()

const { t } = useI18n()

const isCopied = ref(false)

const tokenSentenceGroups = computed(() => groupTokensBySentence(props.sentence.hanzi, props.tokens))
const hasMultipleSentences = computed(() => tokenSentenceGroups.value.length > 1)
const naturalLines = computed(() => splitTextIntoSentenceLines(props.sentence.translation))
const literalLines = computed(() => splitTextIntoSentenceLines(props.sentence.literalTranslation))
const formulaLines = computed(() => splitFormulaIntoLines(props.sentence.structuralFormula))

function isTokenSelected(token: LexemeToken): boolean {
  if (!props.selectedNode) {
    return false
  }

  if (props.selectedNode.kind === 'token') {
    return props.selectedNode.token.id === token.id
  }

  if (props.selectedNode.kind === 'character' || props.selectedNode.kind === 'component') {
    return props.selectedNode.token.id === token.id
  }

  return false
}

async function copySentence(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.sentence.hanzi)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 1800)
  }
  catch {
    // Ignore clipboard error
  }
}

function onTokenClick(token: LexemeToken): void {
  emit('selectToken', token)
  emit('speak', token.hanzi)
}
</script>

<template>
  <section class="overview-card">
    <!-- Top Meta & Actions Bar -->
    <div class="overview-topbar">
      <div class="meta-badges">
        <span class="meta-badge badge-hsk">{{ props.sentence.hskLevel }}</span>
        <span class="meta-badge badge-register">{{ props.sentence.register }}</span>
        <span class="meta-badge badge-type">{{ props.sentence.sentenceType }}</span>
      </div>

      <div class="overview-actions">
        <button
          type="button"
          class="action-pill"
          :title="t('plugins.chinese-analyzer.copySentence')"
          @click="copySentence"
        >
          <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
          <span class="pill-text-desktop">
            {{ isCopied ? t('plugins.chinese-analyzer.copied') : t('plugins.chinese-analyzer.copySentence') }}
          </span>
        </button>

        <button
          type="button"
          class="action-pill primary-pill"
          :class="{ playing: props.isPlayingAudio }"
          @click="emit('speak', props.sentence.hanzi)"
        >
          <Icon :icon="props.isPlayingAudio ? 'mdi:stop' : 'mdi:volume-high'" />
          <span>{{ t('plugins.chinese-analyzer.listenSentence') }}</span>
        </button>
      </div>
    </div>

    <!-- Original Russian Query Banner (when translated from RU) -->
    <div v-if="props.sentence.inputLanguage === 'ru'" class="original-query-banner">
      <Icon icon="mdi:translate" class="query-icon" />
      <span class="query-label">{{ t('plugins.chinese-analyzer.originalRussianInput') }}:</span>
      <span class="query-value">«{{ props.sentence.originalInput }}»</span>
    </div>

    <!-- Interactive Ruby Lexeme Ribbon (Separated by Sentence Rows) -->
    <div class="ruby-sentence-ribbon" :class="{ 'is-multi-sentence': hasMultipleSentences }">
      <div
        v-for="group in tokenSentenceGroups"
        :key="`sent_${group.sentenceIndex}`"
        class="ruby-sentence-row"
      >
        <span v-if="hasMultipleSentences" class="sentence-index-badge">
          {{ group.sentenceIndex + 1 }}
        </span>

        <div class="ruby-sentence-tokens">
          <template v-for="item in group.items" :key="item.token.id">
            <button
              type="button"
              class="ruby-token-item"
              :class="[getPosClass(item.token.pos), { 'is-selected': isTokenSelected(item.token) }]"
              @click="onTokenClick(item.token)"
            >
              <span class="ruby-pinyin">{{ item.token.pinyin }}</span>
              <span class="ruby-hanzi">
                {{ item.token.hanzi }}
              </span>
              <span class="ruby-gloss">{{ item.token.meaning }}</span>
            </button>

            <span v-if="item.trailingPunctuation" class="ruby-punct">
              {{ item.trailingPunctuation }}
            </span>
          </template>
        </div>
      </div>
    </div>

    <!-- Translations & Formula Grid (Grouped single surface on mobile) -->
    <div class="translations-grid">
      <div class="translation-box natural-box">
        <div class="box-label">
          <Icon icon="mdi:chat-processing-outline" class="box-icon" />
          <span>{{ t('plugins.chinese-analyzer.naturalTranslation') }}</span>
        </div>
        <div class="box-lines-list" :class="{ 'is-multiline': naturalLines.length > 1 }">
          <p
            v-for="(line, idx) in naturalLines"
            :key="`nat_${idx}`"
            class="box-text primary-translation"
          >
            {{ line }}
          </p>
        </div>
      </div>

      <div class="translation-box literal-box">
        <div class="box-label">
          <Icon icon="mdi:layers-triple-outline" class="box-icon" />
          <span>{{ t('plugins.chinese-analyzer.literalTranslation') }}</span>
        </div>
        <div class="box-lines-list" :class="{ 'is-multiline': literalLines.length > 1 }">
          <p
            v-for="(line, idx) in literalLines"
            :key="`lit_${idx}`"
            class="box-text literal-text"
          >
            {{ line }}
          </p>
        </div>
      </div>

      <div class="translation-box formula-box">
        <div class="box-label">
          <Icon icon="mdi:sitemap-outline" class="box-icon" />
          <span>{{ t('plugins.chinese-analyzer.structuralFormula') }}</span>
        </div>
        <div class="box-lines-list" :class="{ 'is-multiline': formulaLines.length > 1 }">
          <p
            v-for="(line, idx) in formulaLines"
            :key="`form_${idx}`"
            class="box-text formula-text"
          >
            {{ line }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.overview-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
  border-radius: 22px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.04);

  @include media-down(sm) {
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    gap: 10px;
  }
}

.overview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;

  @include media-down(sm) {
    gap: 8px;
  }
}

.meta-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.76rem;
  font-weight: 700;

  &.badge-hsk {
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
    border: 1px solid rgba(var(--fg-accent-color-rgb), 0.3);
  }

  &.badge-register {
    background: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
  }

  &.badge-type {
    background: var(--bg-primary-color);
    color: var(--fg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    font-weight: 600;
  }

  @include media-down(sm) {
    padding: 3px 8px;
    font-size: 0.7rem;
    border-radius: 7px;

    &.badge-type {
      background: var(--bg-secondary-color);
    }
  }
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.action-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }

  &.primary-pill {
    background: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    color: #ffffff;

    &:hover {
      filter: brightness(1.08);
      color: #ffffff;
    }

    &.playing {
      background: var(--fg-error-color);
      border-color: var(--fg-error-color);
    }
  }

  @include media-down(sm) {
    padding: 5px 9px;
    font-size: 0.74rem;
    border-radius: 9px;
    background: var(--bg-secondary-color);

    .pill-text-desktop {
      display: none;
    }
  }
}

.original-query-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 11px;
  background: rgba(38, 157, 105, 0.1);
  border: 1px solid rgba(38, 157, 105, 0.25);
  font-size: 0.84rem;
  flex-wrap: wrap;

  .query-icon {
    color: var(--fg-success-color);
    font-size: 1rem;
    flex-shrink: 0;
  }

  .query-label {
    font-weight: 700;
    color: var(--fg-success-color);
  }

  .query-value {
    color: var(--fg-primary-color);
    font-weight: 500;
  }

  @include media-down(sm) {
    padding: 7px 10px;
    font-size: 0.78rem;
  }
}

.ruby-sentence-ribbon {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 10px;
    gap: 10px;
    border-radius: 14px;
    background: var(--bg-secondary-color);
  }
}

.ruby-sentence-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  .is-multi-sentence & + .ruby-sentence-row {
    padding-top: 12px;
    border-top: 1px dashed var(--border-secondary-color);

    @include media-down(sm) {
      padding-top: 10px;
    }
  }

  @include media-down(sm) {
    gap: 7px;
  }
}

.sentence-index-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 6px;
  border-radius: 7px;
  background: rgba(var(--fg-accent-color-rgb), 0.12);
  color: var(--fg-accent-color);
  font-size: 0.72rem;
  font-weight: 800;
  flex-shrink: 0;

  @include media-down(sm) {
    width: 19px;
    height: 19px;
    margin-top: 4px;
    font-size: 0.66rem;
    border-radius: 6px;
  }
}

.ruby-sentence-tokens {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 10px;
  flex: 1;
  min-width: 0;

  @include media-down(sm) {
    gap: 6px;
  }
}

.ruby-punct {
  display: inline-flex;
  align-items: center;
  padding: 0 2px;
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--fg-tertiary-color);
  user-select: none;

  @include media-down(sm) {
    font-size: 1.15rem;
    padding: 0;
  }
}

.ruby-token-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
  min-width: 64px;
  padding: 9px 12px;
  border-radius: 13px;
  border: 1px solid var(--border-secondary-color);
  border-bottom: 3px solid var(--fg-accent-color);
  background: var(--bg-secondary-color);
  cursor: pointer;
  font-family: inherit;
  transition:
    box-shadow 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  }

  &.is-selected {
    background: rgba(var(--fg-accent-color-rgb), 0.12);
    border-color: var(--fg-accent-color);
    box-shadow: 0 0 0 2px rgba(var(--fg-accent-color-rgb), 0.22);
  }

  &.pos-noun {
    border-bottom-color: #3b82f6;
  }

  &.pos-verb {
    border-bottom-color: #ef4444;
  }

  &.pos-adj {
    border-bottom-color: #10b981;
  }

  &.pos-adv {
    border-bottom-color: #a855f7;
  }

  &.pos-prep {
    border-bottom-color: #f59e0b;
  }

  &.pos-pron {
    border-bottom-color: #06b6d4;
  }

  &.pos-particle {
    border-bottom-color: #64748b;
  }

  .ruby-pinyin {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
    letter-spacing: 0.02em;
  }

  .ruby-hanzi {
    font-size: 1.65rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    line-height: 1.18;
  }

  .ruby-gloss {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--fg-tertiary-color);
    max-width: 115px;
    line-height: 1.35;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  @include media-down(sm) {
    min-width: 48px;
    padding: 6px 8px;
    gap: 2px;
    border-radius: 10px;
    background: var(--bg-primary-color);
    border-bottom-width: 2.5px;

    .ruby-pinyin {
      font-size: 0.7rem;
    }

    .ruby-hanzi {
      font-size: 1.28rem;
    }

    .ruby-gloss {
      font-size: 0.65rem;
      max-width: 112px;
    }
  }
}

.translations-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @include media-down(md) {
    grid-template-columns: 1fr;
  }

  @include media-down(sm) {
    gap: 0;
    border-radius: 14px;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-secondary-color);
    overflow: hidden;
  }
}

.translation-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 13px 15px;
  border-radius: 14px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  .box-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-secondary-color);
  }

  .box-icon {
    font-size: 0.96rem;
    color: var(--fg-accent-color);
  }

  .box-lines-list {
    display: flex;
    flex-direction: column;
    gap: 6px;

    &.is-multiline .box-text + .box-text {
      padding-top: 6px;
      border-top: 1px dashed var(--border-secondary-color);
    }
  }

  .box-text {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.45;
    color: var(--fg-primary-color);
  }

  .primary-translation {
    font-size: 1rem;
    font-weight: 600;
  }

  .literal-text {
    color: var(--fg-secondary-color);
    font-size: 0.86rem;
  }

  .formula-text {
    font-family: monospace;
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--fg-accent-color);
  }

  @include media-down(sm) {
    padding: 9px 12px;
    gap: 4px;
    border-radius: 0;
    background: transparent;
    border: none;

    & + .translation-box {
      border-top: 1px solid var(--border-secondary-color);
    }

    .box-label {
      font-size: 0.68rem;
    }

    .box-lines-list {
      gap: 4px;

      &.is-multiline .box-text + .box-text {
        padding-top: 4px;
      }
    }

    .primary-translation {
      font-size: 0.92rem;
    }

    .literal-text {
      font-size: 0.8rem;
    }

    .formula-text {
      font-size: 0.78rem;
    }
  }
}
</style>
