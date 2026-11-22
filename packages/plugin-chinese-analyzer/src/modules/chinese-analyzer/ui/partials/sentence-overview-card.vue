<script setup lang="ts">
import type { CanvasSelectedNode, LexemeToken, SentenceOverview } from '../../model'
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getPosClass } from '../../../../shared/lib/tone-utils'

interface Props {
  sentence: SentenceOverview
  tokens: LexemeToken[]
  selectedNode: CanvasSelectedNode | null
  showTraditional: boolean
  isPlayingAudio: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:showTraditional': [value: boolean]
  'selectToken': [token: LexemeToken]
  'speak': [text: string]
}>()

const { t } = useI18n()

const isCopied = ref(false)

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
  const textToCopy = props.showTraditional ? props.sentence.traditional : props.sentence.hanzi

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
          :class="{ active: props.showTraditional }"
          @click="emit('update:showTraditional', !props.showTraditional)"
        >
          <Icon icon="mdi:ideogram-cjk-variant" />
          <span>
            {{ props.showTraditional ? t('plugins.chinese-analyzer.showTraditional') : t('plugins.chinese-analyzer.showSimplified') }}
          </span>
        </button>

        <button
          type="button"
          class="action-pill"
          @click="copySentence"
        >
          <Icon :icon="isCopied ? 'mdi:check' : 'mdi:content-copy'" />
          <span>{{ isCopied ? t('plugins.chinese-analyzer.copied') : t('plugins.chinese-analyzer.copySentence') }}</span>
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

    <!-- Interactive Ruby Lexeme Ribbon -->
    <div class="ruby-sentence-ribbon">
      <button
        v-for="token in props.tokens"
        :key="token.id"
        type="button"
        class="ruby-token-item"
        :class="[getPosClass(token.pos), { 'is-selected': isTokenSelected(token) }]"
        @click="onTokenClick(token)"
      >
        <span class="ruby-pinyin">{{ token.pinyin }}</span>
        <span class="ruby-hanzi">
          {{ props.showTraditional ? token.traditional : token.hanzi }}
        </span>
        <span class="ruby-gloss">{{ token.meaning }}</span>
      </button>
    </div>

    <!-- Translations & Formula Grid -->
    <div class="translations-grid">
      <div class="translation-box natural-box">
        <div class="box-label">
          <Icon icon="mdi:chat-processing-outline" class="box-icon" />
          <span>{{ t('plugins.chinese-analyzer.naturalTranslation') }}</span>
        </div>
        <p class="box-text primary-translation">
          {{ props.sentence.translation }}
        </p>
      </div>

      <div class="translation-box literal-box">
        <div class="box-label">
          <Icon icon="mdi:layers-triple-outline" class="box-icon" />
          <span>{{ t('plugins.chinese-analyzer.literalTranslation') }}</span>
        </div>
        <p class="box-text literal-text">
          {{ props.sentence.literalTranslation }}
        </p>
      </div>

      <div class="translation-box formula-box">
        <div class="box-label">
          <Icon icon="mdi:sitemap-outline" class="box-icon" />
          <span>{{ t('plugins.chinese-analyzer.structuralFormula') }}</span>
        </div>
        <p class="box-text formula-text">
          {{ props.sentence.structuralFormula }}
        </p>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.overview-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 22px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.04);

  @include media-down(sm) {
    padding: 16px;
    border-radius: 18px;
    gap: 14px;
  }
}

.overview-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 11px;
  border-radius: 9px;
  font-size: 0.78rem;
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
}

.overview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 11px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 0.82rem;
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
}

.original-query-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 12px;
  background: rgba(38, 157, 105, 0.1);
  border: 1px solid rgba(38, 157, 105, 0.25);
  font-size: 0.86rem;

  .query-icon {
    color: var(--fg-success-color);
    font-size: 1.05rem;
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
}

.ruby-sentence-ribbon {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 10px;
  padding: 16px;
  border-radius: 18px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
}

.ruby-token-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-width: 68px;
  padding: 10px 14px;
  border-radius: 14px;
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
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--fg-secondary-color);
    letter-spacing: 0.02em;
  }

  .ruby-hanzi {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    line-height: 1.2;
  }

  .ruby-gloss {
    font-size: 0.74rem;
    font-weight: 500;
    color: var(--fg-tertiary-color);
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.translations-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @include media-down(md) {
    grid-template-columns: 1fr;
  }
}

.translation-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  .box-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-secondary-color);
  }

  .box-icon {
    font-size: 0.98rem;
    color: var(--fg-accent-color);
  }

  .box-text {
    margin: 0;
    font-size: 0.94rem;
    line-height: 1.48;
    color: var(--fg-primary-color);
  }

  .primary-translation {
    font-size: 1.02rem;
    font-weight: 600;
  }

  .literal-text {
    color: var(--fg-secondary-color);
    font-size: 0.88rem;
  }

  .formula-text {
    font-family: monospace;
    font-size: 0.86rem;
    font-weight: 600;
    color: var(--fg-accent-color);
  }
}
</style>
