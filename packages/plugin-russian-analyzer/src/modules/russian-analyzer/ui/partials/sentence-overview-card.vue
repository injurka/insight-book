<script setup lang="ts">
import type { CanvasSelectedNode, RussianLexemeToken, RussianSentenceOverview } from '../../model'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCaseClass, getPosClass } from '../../../../shared/lib/russian-utils'
import {
  groupTokensBySentence,
  splitFormulaIntoLines,
  splitTextIntoSentenceLines,
} from '../../../../shared/lib/sentence-segmentation'

interface Props {
  sentence: RussianSentenceOverview
  tokens: RussianLexemeToken[]
  selectedNode: CanvasSelectedNode | null
  showStressMarks: boolean
  isPlayingAudio: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:showStressMarks': [value: boolean]
  'selectToken': [token: RussianLexemeToken]
  'speak': [text: string]
}>()

const { t } = useI18n()

const isCopied = ref(false)

const tokenSentenceGroups = computed(() => groupTokensBySentence(props.sentence.plainText, props.tokens))
const hasMultipleSentences = computed(() => tokenSentenceGroups.value.length > 1)
const naturalLines = computed(() => splitTextIntoSentenceLines(props.sentence.translation))
const literalLines = computed(() => splitTextIntoSentenceLines(props.sentence.literalTranslation))
const formulaLines = computed(() => splitFormulaIntoLines(props.sentence.structuralFormula))

function isTokenSelected(token: RussianLexemeToken): boolean {
  if (!props.selectedNode) {
    return false
  }

  if (props.selectedNode.kind === 'token' || props.selectedNode.kind === 'morpheme' || props.selectedNode.kind === 'feature') {
    return props.selectedNode.token.id === token.id
  }

  return false
}

function getTokenTopTag(token: RussianLexemeToken): string {
  if (token.morphology.caseLabel) {
    return token.morphology.caseLabel
  }

  if (token.morphology.aspect) {
    return token.morphology.aspect
  }

  return token.posLabel
}

async function copySentence(): Promise<void> {
  const textToCopy = props.showStressMarks ? props.sentence.stressedText : props.sentence.plainText

  try {
    await navigator.clipboard.writeText(textToCopy)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 1800)
  }
  catch {
    // Ignore clipboard error
  }
}

function onTokenClick(token: RussianLexemeToken): void {
  emit('selectToken', token)
  emit('speak', token.word)
}
</script>

<template>
  <section class="overview-card">
    <!-- Top Meta & Actions Bar -->
    <div class="overview-topbar">
      <div class="meta-badges">
        <span class="meta-badge badge-cefr">{{ props.sentence.cefrLevel }}</span>
        <span class="meta-badge badge-register">{{ props.sentence.register }}</span>
        <span v-if="props.sentence.sentenceType" class="meta-badge badge-type">
          {{ props.sentence.sentenceType }}
        </span>
      </div>

      <div class="overview-actions">
        <button
          type="button"
          class="action-pill"
          :class="{ active: props.showStressMarks }"
          @click="emit('update:showStressMarks', !props.showStressMarks)"
        >
          <Icon icon="mdi:format-letter-case" />
          <span class="pill-text-desktop">{{ t('plugins.russian-analyzer.toggleStressMarks') }}</span>
          <span class="pill-text-mobile">а́</span>
        </button>

        <button
          type="button"
          class="action-pill"
          :title="t('plugins.russian-analyzer.copySentence')"
          @click="copySentence"
        >
          <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
          <span class="pill-text-desktop">
            {{ isCopied ? t('plugins.russian-analyzer.copied') : t('plugins.russian-analyzer.copySentence') }}
          </span>
        </button>

        <button
          type="button"
          class="action-pill primary-pill"
          :class="{ playing: props.isPlayingAudio }"
          @click="emit('speak', props.sentence.plainText)"
        >
          <Icon :icon="props.isPlayingAudio ? 'mdi:stop' : 'mdi:volume-high'" />
          <span>{{ t('plugins.russian-analyzer.listenSentence') }}</span>
        </button>
      </div>
    </div>

    <!-- Original Query Banner (when translated from ZH or EN) -->
    <div v-if="props.sentence.inputLanguage !== 'ru'" class="original-query-banner">
      <Icon icon="mdi:translate" class="query-icon" />
      <span class="query-label">{{ t('plugins.russian-analyzer.originalInputLabel') }}:</span>
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
              :class="[
                getPosClass(item.token.pos),
                getCaseClass(item.token.morphology.caseCode),
                { 'is-selected': isTokenSelected(item.token) },
              ]"
              @click="onTokenClick(item.token)"
            >
              <span class="ruby-top-tag">{{ getTokenTopTag(item.token) }}</span>
              <span class="ruby-word russian-phonetic-text">
                {{ props.showStressMarks ? item.token.stressedWord : item.token.word }}
              </span>
              <span class="ruby-gloss">{{ item.token.meaning }}</span>
            </button>

            <span v-if="item.trailingPunctuation" class="ruby-punct">
              {{ item.trailingPunctuation }}
            </span>
          </template>
        </div>
      </div>

      <div v-if="props.sentence.ipa" class="ipa-footer-line">
        <span class="ipa-tag">IPA</span>
        <span class="ipa-text russian-phonetic-text">{{ props.sentence.ipa }}</span>
      </div>
    </div>

    <!-- Translations & Formula Grid (Grouped single surface on mobile) -->
    <div class="translations-grid">
      <div class="translation-box natural-box">
        <div class="box-label">
          <Icon icon="mdi:chat-processing-outline" class="box-icon" />
          <span>{{ t('plugins.russian-analyzer.naturalTranslation') }}</span>
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
          <span>{{ t('plugins.russian-analyzer.literalTranslation') }}</span>
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
          <span>{{ t('plugins.russian-analyzer.structuralFormula') }}</span>
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

  &.badge-cefr {
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

.pill-text-mobile {
  display: none;
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

  &.active {
    background: rgba(var(--fg-accent-color-rgb), 0.12);
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

    .pill-text-mobile {
      display: inline;
      font-weight: 700;
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
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--fg-tertiary-color);
  user-select: none;

  @include media-down(sm) {
    font-size: 1.1rem;
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
  min-width: 72px;
  padding: 9px 13px;
  border-radius: 13px;
  border: 1px solid var(--border-secondary-color);
  border-bottom: 3px solid var(--fg-accent-color);
  background: var(--bg-secondary-color);
  cursor: pointer;
  font-family: inherit;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    transform: translateY(-2px);
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

  &.pos-verb,
  &.pos-participle {
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

  &.pos-particle,
  &.pos-conj {
    border-bottom-color: #64748b;
  }

  .ruby-top-tag {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--fg-secondary-color);
    max-width: 130px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ruby-word {
    font-size: 1.32rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    line-height: 1.2;
  }

  .ruby-gloss {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--fg-tertiary-color);
    max-width: 135px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @include media-down(sm) {
    min-width: 54px;
    padding: 6px 9px;
    gap: 2px;
    border-radius: 10px;
    background: var(--bg-primary-color);
    border-bottom-width: 2.5px;

    .ruby-top-tag {
      font-size: 0.62rem;
      max-width: 96px;
    }

    .ruby-word {
      font-size: 1.05rem;
    }

    .ruby-gloss {
      font-size: 0.64rem;
      max-width: 96px;
    }
  }
}

.ipa-footer-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-secondary-color);
  font-size: 0.82rem;

  .ipa-tag {
    padding: 1px 6px;
    border-radius: 5px;
    font-size: 0.68rem;
    font-weight: 800;
    background: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
  }

  .ipa-text {
    color: var(--fg-secondary-color);
    word-break: break-word;
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
