<script setup lang="ts">
import type {
  CanvasSelectedNode,
  MorphemeFeatureNode,
  MorphemeNode,
  RussianLexemeToken,
} from '../../model'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import {
  getMorphemeClass,
  getMorphemeShortSymbol,
  getPosClass,
} from '../../../../shared/lib/russian-utils'

interface Props {
  selectedNode: CanvasSelectedNode | null
  allTokens: RussianLexemeToken[]
  showStressMarks: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectNode: [node: CanvasSelectedNode]
  speak: [text: string]
  analyzeQuery: [text: string]
}>()

const { t } = useI18n()

function getMorphemeTypeBadge(type: MorphemeNode['type']): string {
  switch (type) {
    case 'prefix':
      return t('plugins.russian-analyzer.morphemePrefix')
    case 'root':
      return t('plugins.russian-analyzer.morphemeRoot')
    case 'suffix':
      return t('plugins.russian-analyzer.morphemeSuffix')
    case 'ending':
      return t('plugins.russian-analyzer.morphemeEnding')
    case 'postfix':
      return t('plugins.russian-analyzer.morphemePostfix')
    default:
      return t('plugins.russian-analyzer.morphemeRoot')
  }
}

function getFeatureTypeBadge(type: MorphemeFeatureNode['type']): string {
  if (type === 'cognate') {
    return t('plugins.russian-analyzer.featureCognate')
  }

  if (type === 'meaning') {
    return t('plugins.russian-analyzer.featureMeaning')
  }

  return t('plugins.russian-analyzer.featureGrammar')
}

function hasDistinctFeatureLabel(feature: MorphemeFeatureNode): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, 'е')
  const label = normalize(feature.label)
  const explanation = normalize(feature.explanation)

  return Boolean(label) && label !== explanation
}

function formatGenderNumber(token: RussianLexemeToken): string {
  return [token.morphology.gender, token.morphology.number, token.morphology.animacy]
    .filter(Boolean)
    .join(' · ')
}

function formatTensePerson(token: RussianLexemeToken): string {
  return [token.morphology.tense, token.morphology.person, token.morphology.mood]
    .filter(Boolean)
    .join(' · ')
}

function selectToken(token: RussianLexemeToken): void {
  emit('selectNode', { kind: 'token', token })
}

function selectMorpheme(token: RussianLexemeToken, morpheme: MorphemeNode, morphemeIndex: number): void {
  emit('selectNode', { kind: 'morpheme', token, morpheme, morphemeIndex })
}

function selectFeature(token: RussianLexemeToken, morpheme: MorphemeNode, feature: MorphemeFeatureNode): void {
  emit('selectNode', { kind: 'feature', token, morpheme, feature })
}

function getClauseTokens(tokenIds: string[]): RussianLexemeToken[] {
  return props.allTokens.filter(tok => tokenIds.includes(tok.id))
}
</script>

<template>
  <aside class="inspector-card">
    <header class="inspector-header">
      <div class="header-left">
        <Icon icon="mdi:compass-outline" class="header-icon" />
        <h3 class="header-title">
          {{ t('plugins.russian-analyzer.inspectorTitle') }}
        </h3>
      </div>

      <!-- Breadcrumb Back Navigation -->
      <div v-if="props.selectedNode" class="inspector-breadcrumbs">
        <button
          v-if="props.selectedNode.kind === 'morpheme' || props.selectedNode.kind === 'feature'"
          type="button"
          class="crumb-btn"
          @click="selectToken(props.selectedNode.token)"
        >
          <span>{{ props.selectedNode.token.word }}</span>
        </button>

        <template v-if="props.selectedNode.kind === 'feature'">
          <Icon icon="mdi:chevron-right" class="crumb-sep" />
          <button
            type="button"
            class="crumb-btn"
            @click="selectMorpheme(props.selectedNode.token, props.selectedNode.morpheme, 0)"
          >
            <span>{{ props.selectedNode.morpheme.text }}</span>
          </button>
        </template>
      </div>
    </header>

    <!-- Empty Hint -->
    <div v-if="!props.selectedNode" class="inspector-empty">
      <Icon icon="mdi:alphabet-cyrillic" class="empty-icon" />
      <p>{{ t('plugins.russian-analyzer.inspectorHint') }}</p>
    </div>

    <!-- CASE 1: Syntactic Clause Selected -->
    <div v-else-if="props.selectedNode.kind === 'clause'" class="inspector-body">
      <div class="hero-box clause-hero">
        <span class="type-kicker">{{ t('plugins.russian-analyzer.layerClauses') }}</span>
        <div class="clause-hero-title">
          {{ props.selectedNode.clause.label }}
        </div>
        <div class="clause-hero-text">
          {{ props.selectedNode.clause.text }}
        </div>
        <div class="clause-hero-trans">
          «{{ props.selectedNode.clause.translation }}»
        </div>
      </div>

      <div v-if="props.selectedNode.clause.role" class="info-row">
        <span class="info-label">{{ t('plugins.russian-analyzer.syntacticRole') }}</span>
        <span class="info-value">{{ props.selectedNode.clause.role }}</span>
      </div>

      <div class="sub-section">
        <span class="sub-title">{{ t('plugins.russian-analyzer.layerWords') }}</span>
        <div class="nested-chips-grid">
          <button
            v-for="tok in getClauseTokens(props.selectedNode.clause.tokenIds)"
            :key="tok.id"
            type="button"
            class="nested-word-chip"
            @click="selectToken(tok)"
          >
            <span class="nw-word russian-phonetic-text">{{ props.showStressMarks ? tok.stressedWord : tok.word }}</span>
            <span class="nw-mean">{{ tok.meaning }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- CASE 2: Word Form / Lexeme Selected -->
    <div v-else-if="props.selectedNode.kind === 'token'" class="inspector-body">
      <div class="hero-box token-hero" :class="getPosClass(props.selectedNode.token.pos)">
        <div class="hero-main-left">
          <div class="hero-badges">
            <span class="pos-pill">{{ props.selectedNode.token.posLabel }}</span>
            <span class="cefr-pill">{{ props.selectedNode.token.cefr }}</span>
          </div>
          <div class="hero-word russian-phonetic-text">
            {{ props.showStressMarks ? props.selectedNode.token.stressedWord : props.selectedNode.token.word }}
          </div>
          <div v-if="props.selectedNode.token.ipa" class="hero-ipa russian-phonetic-text">
            {{ props.selectedNode.token.ipa }}
          </div>
          <div class="hero-meaning">
            {{ props.selectedNode.token.meaning }}
          </div>
        </div>

        <div class="hero-btn-stack">
          <button
            type="button"
            class="inspector-action-btn"
            @click="emit('speak', props.selectedNode.token.word)"
          >
            <Icon icon="mdi:volume-high" />
          </button>
          <button
            type="button"
            class="inspector-action-btn"
            :title="t('plugins.russian-analyzer.analyzeThisWord')"
            @click="emit('analyzeQuery', props.selectedNode.token.word)"
          >
            <Icon icon="mdi:auto-fix" />
          </button>
        </div>
      </div>

      <!-- Russian Morphological Grid (Lemma, Case, Gender/Number, Aspect, Tense) -->
      <div class="details-grid">
        <div class="info-block">
          <span class="info-label">{{ t('plugins.russian-analyzer.lemmaLabel') }}</span>
          <span class="info-value">{{ props.selectedNode.token.lemma }}</span>
        </div>

        <div class="info-block">
          <span class="info-label">{{ t('plugins.russian-analyzer.syntacticRole') }}</span>
          <span class="info-value accent-val">{{ props.selectedNode.token.syntacticRole || props.selectedNode.token.posLabel }}</span>
        </div>

        <div v-if="props.selectedNode.token.morphology.caseLabel" class="info-block">
          <span class="info-label">{{ t('plugins.russian-analyzer.caseLabel') }}</span>
          <span class="info-value accent-val">
            {{ props.selectedNode.token.morphology.caseLabel }}
            <template v-if="props.selectedNode.token.morphology.caseQuestion">
              ({{ props.selectedNode.token.morphology.caseQuestion }})
            </template>
          </span>
        </div>

        <div v-if="formatGenderNumber(props.selectedNode.token)" class="info-block">
          <span class="info-label">{{ t('plugins.russian-analyzer.genderNumberLabel') }}</span>
          <span class="info-value">{{ formatGenderNumber(props.selectedNode.token) }}</span>
        </div>

        <div v-if="props.selectedNode.token.morphology.aspect" class="info-block">
          <span class="info-label">{{ t('plugins.russian-analyzer.aspectLabel') }}</span>
          <span class="info-value accent-val">{{ props.selectedNode.token.morphology.aspect }}</span>
        </div>

        <div v-if="props.selectedNode.token.morphology.aspectPair" class="info-block">
          <span class="info-label">{{ t('plugins.russian-analyzer.aspectPairLabel') }}</span>
          <span class="info-value">{{ props.selectedNode.token.morphology.aspectPair }}</span>
        </div>

        <div v-if="formatTensePerson(props.selectedNode.token)" class="info-block">
          <span class="info-label">{{ t('plugins.russian-analyzer.tensePersonLabel') }}</span>
          <span class="info-value">{{ formatTensePerson(props.selectedNode.token) }}</span>
        </div>

        <div v-if="props.selectedNode.token.dictionaryMeaning" class="info-block">
          <span class="info-label">{{ t('plugins.russian-analyzer.dictionaryMeaning') }}</span>
          <span class="info-value">{{ props.selectedNode.token.dictionaryMeaning }}</span>
        </div>
      </div>

      <div v-if="props.selectedNode.token.grammarNote" class="grammar-note-box">
        <div class="note-heading">
          <Icon icon="mdi:school-outline" />
          <span>{{ t('plugins.russian-analyzer.grammarFunction') }}</span>
        </div>
        <p>{{ props.selectedNode.token.grammarNote }}</p>
      </div>

      <div v-if="props.selectedNode.token.caseGovernmentNote" class="government-note-box">
        <div class="note-heading">
          <Icon icon="mdi:sitemap-outline" />
          <span>{{ t('plugins.russian-analyzer.caseGovernmentLabel') }}</span>
        </div>
        <p>{{ props.selectedNode.token.caseGovernmentNote }}</p>
      </div>

      <!-- Morphemic Composition Drill-Down -->
      <div v-if="props.selectedNode.token.morphemes.length > 0" class="sub-section">
        <span class="sub-title">{{ t('plugins.russian-analyzer.morphemeBreakdown') }}</span>
        <div class="morph-drill-list">
          <div
            v-for="(morph, idx) in props.selectedNode.token.morphemes"
            :key="`${morph.text}_${idx}`"
            class="morph-drill-card"
            :class="getMorphemeClass(morph.type)"
            @click="selectMorpheme(props.selectedNode.token, morph, idx)"
          >
            <div class="md-badge">
              <span class="md-glyph">{{ getMorphemeShortSymbol(morph.type) }}</span>
              <span class="md-text">{{ morph.text }}</span>
            </div>
            <div class="md-content">
              <span class="md-type">{{ getMorphemeTypeBadge(morph.type) }}</span>
              <span class="md-meaning">{{ morph.meaning }}</span>
              <span v-if="morph.roleInWord" class="md-role">{{ morph.roleInWord }}</span>
            </div>
            <Icon icon="mdi:chevron-right" class="md-arrow" />
          </div>
        </div>
      </div>

      <!-- Collocations -->
      <div v-if="props.selectedNode.token.collocations.length > 0" class="sub-section">
        <span class="sub-title">{{ t('plugins.russian-analyzer.collocationsTitle') }}</span>
        <div class="collocations-list">
          <div
            v-for="(col, cIdx) in props.selectedNode.token.collocations"
            :key="`${col.text}_${cIdx}`"
            class="collocation-item"
          >
            <div class="col-main">
              <span class="col-text russian-phonetic-text">{{ props.showStressMarks ? col.stressedText : col.text }}</span>
              <span class="col-trans">— {{ col.translation }}</span>
            </div>
            <button
              type="button"
              class="col-speak-btn"
              @click="emit('speak', col.text)"
            >
              <Icon icon="mdi:volume-medium" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CASE 3: Morpheme Selected -->
    <div v-else-if="props.selectedNode.kind === 'morpheme'" class="inspector-body">
      <div class="hero-box morph-hero" :class="getMorphemeClass(props.selectedNode.morpheme.type)">
        <div class="hero-main-left">
          <div class="hero-badges">
            <span class="pos-pill">
              {{ getMorphemeShortSymbol(props.selectedNode.morpheme.type) }}
              {{ getMorphemeTypeBadge(props.selectedNode.morpheme.type) }}
            </span>
          </div>
          <div class="hero-word russian-phonetic-text">
            {{ props.selectedNode.morpheme.text }}
          </div>
          <div class="hero-meaning">
            {{ props.selectedNode.morpheme.meaning }}
          </div>
        </div>
      </div>

      <div v-if="props.selectedNode.morpheme.roleInWord" class="grammar-note-box">
        <div class="note-heading">
          <Icon icon="mdi:sitemap-outline" />
          <span>{{ t('plugins.russian-analyzer.roleInWord') }} «{{ props.selectedNode.token.word }}»</span>
        </div>
        <p>{{ props.selectedNode.morpheme.roleInWord }}</p>
      </div>

      <div v-if="props.selectedNode.morpheme.etymology" class="etymology-box">
        <div class="note-heading">
          <Icon icon="mdi:lightbulb-on-outline" />
          <span>{{ t('plugins.russian-analyzer.etymologyTitle') }}</span>
        </div>
        <p>{{ props.selectedNode.morpheme.etymology }}</p>
      </div>

      <div v-if="props.selectedNode.morpheme.features.length > 0" class="sub-section">
        <span class="sub-title">{{ t('plugins.russian-analyzer.featuresTitle') }}</span>
        <div class="features-grid">
          <div
            v-for="(feat, idx) in props.selectedNode.morpheme.features"
            :key="`${feat.symbol}_${idx}`"
            class="feature-detail-card"
            :class="`feat-border-${feat.type}`"
            @click="selectFeature(props.selectedNode.token, props.selectedNode.morpheme, feat)"
          >
            <div class="fd-symbol">
              {{ feat.symbol }}
            </div>
            <div class="fd-info">
              <span class="fd-type">{{ getFeatureTypeBadge(feat.type) }}</span>
              <span v-if="hasDistinctFeatureLabel(feat)" class="fd-label">{{ feat.label }}</span>
              <span class="fd-meaning">{{ feat.explanation || feat.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CASE 4: Grammatical Feature / Cognate Selected -->
    <div v-else-if="props.selectedNode.kind === 'feature'" class="inspector-body">
      <div class="hero-box comp-hero">
        <span class="type-kicker">{{ getFeatureTypeBadge(props.selectedNode.feature.type) }}</span>
        <div class="hero-word russian-phonetic-text">
          {{ props.selectedNode.feature.symbol }}
        </div>
        <div v-if="hasDistinctFeatureLabel(props.selectedNode.feature)" class="hero-ipa russian-phonetic-text">
          {{ props.selectedNode.feature.label }}
        </div>
        <div class="hero-meaning">
          {{ props.selectedNode.feature.explanation || props.selectedNode.feature.label }}
        </div>
      </div>

      <div v-if="props.selectedNode.morpheme.roleInWord" class="grammar-note-box">
        <div class="note-heading">
          <Icon icon="mdi:layers-triple-outline" />
          <span>«{{ props.selectedNode.morpheme.text }}» ← {{ props.selectedNode.token.word }}</span>
        </div>
        <p>{{ props.selectedNode.morpheme.roleInWord }}</p>
      </div>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.inspector-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-radius: 22px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);

  @include media-down(sm) {
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: none;
    box-shadow: none;
    gap: 10px;
  }
}

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;

  @include media-down(sm) {
    padding-bottom: 6px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-icon {
    font-size: 1.25rem;
    color: var(--fg-accent-color);
  }

  .header-title {
    margin: 0;
    font-size: 1.02rem;
    font-weight: 800;
    color: var(--fg-primary-color);

    @include media-down(sm) {
      font-size: 0.94rem;
    }
  }
}

.inspector-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;

  .crumb-btn {
    padding: 3px 9px;
    border-radius: 8px;
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-primary-color);
    color: var(--fg-accent-color);
    font-family: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;

    &:hover {
      border-color: var(--fg-accent-color);
    }
  }

  .crumb-sep {
    font-size: 0.9rem;
    color: var(--fg-tertiary-color);
  }
}

.inspector-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 36px 16px;
  text-align: center;
  color: var(--fg-secondary-color);

  .empty-icon {
    font-size: 2.4rem;
    opacity: 0.5;
    color: var(--fg-accent-color);
  }

  p {
    margin: 0;
    font-size: 0.88rem;
  }
}

.inspector-body {
  display: flex;
  flex-direction: column;
  gap: 14px;

  @include media-down(sm) {
    gap: 10px;
  }
}

.hero-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-radius: 16px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: 4px solid var(--fg-accent-color);

  @include media-down(sm) {
    padding: 11px 12px;
    gap: 10px;
    border-radius: 13px;
    background: var(--bg-secondary-color);
  }

  &.clause-hero,
  &.comp-hero {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .type-kicker {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-accent-color);
  }

  .clause-hero-title {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .clause-hero-text {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--fg-accent-color);
  }

  .clause-hero-trans {
    font-size: 0.88rem;
    color: var(--fg-secondary-color);
  }
}

.hero-main-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hero-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;

  .pos-pill {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
  }

  .cefr-pill {
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
  }
}

.hero-word {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--fg-primary-color);
  line-height: 1.18;
  word-break: break-word;

  @include media-down(sm) {
    font-size: 1.4rem;
  }
}

.hero-ipa {
  font-size: 0.84rem;
  color: var(--fg-secondary-color);
}

.hero-meaning {
  font-size: 0.96rem;
  font-weight: 700;
  color: var(--fg-primary-color);

  @include media-down(sm) {
    font-size: 0.88rem;
  }
}

.hero-btn-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.inspector-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-size: 1.1rem;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;

  @include media-down(sm) {
    gap: 8px;
  }
}

.info-block,
.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 8px 10px;
    border-radius: 11px;
    background: var(--bg-secondary-color);
  }

  .info-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }

  .info-value {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    word-break: break-word;

    &.accent-val {
      color: var(--fg-accent-color);
    }
  }
}

.grammar-note-box,
.government-note-box,
.etymology-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 13px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 9px 11px;
    border-radius: 11px;
    background: var(--bg-secondary-color);
  }

  .note-heading {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    font-weight: 700;
    color: var(--fg-accent-color);
  }

  p {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.5;
    color: var(--fg-primary-color);
  }
}

.government-note-box {
  background: rgba(59, 130, 246, 0.06);
  border-color: rgba(59, 130, 246, 0.24);

  .note-heading {
    color: #3b82f6;
  }
}

.etymology-box {
  background: rgba(245, 158, 11, 0.07);
  border-color: rgba(245, 158, 11, 0.25);

  .note-heading {
    color: #d97706;
  }
}

.sub-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .sub-title {
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--fg-secondary-color);
  }
}

.morph-drill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.morph-drill-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 13px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: 3px solid var(--fg-accent-color);
  cursor: pointer;
  transition: all 0.18s ease;

  @include media-down(sm) {
    padding: 8px 10px;
    gap: 10px;
    border-radius: 11px;
    background: var(--bg-secondary-color);
  }

  &:hover {
    border-color: var(--fg-accent-color);
    transform: translateX(2px);
  }

  &.morph-prefix {
    border-left-color: #f59e0b;
  }

  &.morph-root {
    border-left-color: #3b82f6;
  }

  &.morph-suffix {
    border-left-color: #10b981;
  }

  &.morph-ending {
    border-left-color: #a855f7;
  }

  &.morph-postfix {
    border-left-color: #06b6d4;
  }

  .md-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 54px;
    padding: 6px 8px;
    border-radius: 10px;
    background: var(--bg-secondary-color);
    border: 1px solid var(--border-primary-color);
    flex-shrink: 0;
  }

  .md-glyph {
    font-size: 0.72rem;
    color: var(--fg-accent-color);
  }

  .md-text {
    font-size: 0.96rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .md-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .md-type {
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }

  .md-meaning {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .md-role {
    font-size: 0.76rem;
    color: var(--fg-secondary-color);
    line-height: 1.35;
  }

  .md-arrow {
    color: var(--fg-tertiary-color);
    font-size: 1.1rem;
  }
}

.collocations-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.collocation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 7px 10px;
    background: var(--bg-secondary-color);
  }

  .col-main {
    display: flex;
    align-items: baseline;
    gap: 7px;
    flex-wrap: wrap;
    font-size: 0.84rem;
  }

  .col-text {
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .col-trans {
    color: var(--fg-secondary-color);
  }

  .col-speak-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: none;
    background: var(--bg-secondary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;

    &:hover {
      color: var(--fg-accent-color);
    }
  }
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.feature-detail-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 12px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-left: 3px solid var(--fg-accent-color);
  cursor: pointer;

  @include media-down(sm) {
    padding: 8px 10px;
    background: var(--bg-secondary-color);
  }

  &:hover {
    border-color: var(--fg-accent-color);
  }

  &.feat-border-grammar {
    border-left-color: #a855f7;
  }

  &.feat-border-cognate {
    border-left-color: #10b981;
  }

  &.feat-border-meaning {
    border-left-color: #f59e0b;
  }

  .fd-symbol {
    font-size: 1.02rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .fd-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .fd-type {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }

  .fd-label {
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .fd-meaning {
    font-size: 0.74rem;
    color: var(--fg-secondary-color);
  }
}

.nested-chips-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.nested-word-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  border-radius: 11px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-primary-color);
  font-family: inherit;
  cursor: pointer;

  &:hover {
    border-color: var(--fg-accent-color);
  }

  .nw-word {
    font-size: 1rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .nw-mean {
    font-size: 0.72rem;
    color: var(--fg-secondary-color);
  }
}
</style>
