<script setup lang="ts">
import type { RussianPhoneticsAnalysis } from '../../model'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  groupWordCardsBySentence,
  splitRhythmIntoSentenceRows,
} from '../../../../shared/lib/sentence-segmentation'

interface Props {
  phonetics: RussianPhoneticsAnalysis
  plainText?: string
  showStressMarks: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  speak: [text: string]
}>()

const { t } = useI18n()

const rhythmRows = computed(() => splitRhythmIntoSentenceRows(props.phonetics.rhythmGrouping))
const wordCardGroups = computed(() => groupWordCardsBySentence(props.plainText || '', props.phonetics.wordStressCards))
const hasMultipleWordGroups = computed(() => wordCardGroups.value.length > 1)
</script>

<template>
  <section class="phonetics-card">
    <header class="section-header">
      <div class="header-icon-box">
        <Icon icon="mdi:waveform" />
      </div>
      <div class="header-titles">
        <h3 class="section-title">
          {{ t('plugins.russian-analyzer.phoneticsSectionTitle') }}
        </h3>
        <p class="section-subtitle">
          {{ t('plugins.russian-analyzer.phoneticsSectionSubtitle') }}
        </p>
      </div>
    </header>

    <!-- Intonation Construction (ИК) Banner -->
    <div v-if="props.phonetics.intonationType" class="ik-banner">
      <div class="ik-top">
        <span class="sub-label ik-label">{{ t('plugins.russian-analyzer.intonationConstructionLabel') }}</span>
        <span class="ik-pill">{{ props.phonetics.intonationType }}</span>
      </div>
      <p v-if="props.phonetics.intonationExplanation" class="ik-desc">
        {{ props.phonetics.intonationExplanation }}
      </p>
    </div>

    <!-- Prosodic Rhythm & Pauses -->
    <div class="rhythm-block">
      <div class="sub-label">
        {{ t('plugins.russian-analyzer.rhythmGroupingLabel') }}
      </div>
      <div class="rhythm-rows">
        <div
          v-for="(row, rowIdx) in rhythmRows"
          :key="`rrow_${rowIdx}`"
          class="rhythm-track"
        >
          <span v-if="rhythmRows.length > 1" class="row-index-badge">
            {{ rowIdx + 1 }}
          </span>
          <template v-for="(seg, idx) in row" :key="`${seg}_${idx}`">
            <button
              type="button"
              class="rhythm-pill"
              @click="emit('speak', seg)"
            >
              <Icon icon="mdi:volume-medium" class="r-icon" />
              <span>{{ seg }}</span>
            </button>
            <span v-if="idx < row.length - 1" class="pause-slash">/</span>
          </template>
        </div>
      </div>
      <p v-if="props.phonetics.intonationNote" class="intonation-note">
        {{ props.phonetics.intonationNote }}
      </p>
    </div>

    <!-- Visual Syllable Stress & Vowel Reduction Rhythm Strip -->
    <div class="stress-block">
      <div class="stress-header-row">
        <div class="sub-label">
          {{ t('plugins.russian-analyzer.stressRhythmLabel') }}
        </div>
        <div class="stress-legend">
          <span class="legend-chip chip-stressed">{{ t('plugins.russian-analyzer.stressedBadge') }}</span>
          <span class="legend-chip chip-reduced">{{ t('plugins.russian-analyzer.reducedBadge') }}</span>
          <span class="legend-chip chip-focus">{{ t('plugins.russian-analyzer.focusWordBadge') }}</span>
        </div>
      </div>

      <div class="stress-groups">
        <div
          v-for="group in wordCardGroups"
          :key="`wgrp_${group.sentenceIndex}`"
          class="stress-sentence-row"
        >
          <span v-if="hasMultipleWordGroups" class="row-index-badge stress-row-badge">
            {{ group.sentenceIndex + 1 }}
          </span>

          <div class="stress-scroll">
            <div
              v-for="(card, idx) in group.cards"
              :key="`${card.word}_${idx}`"
              class="word-stress-card"
              :class="{ 'is-focus': card.isSentenceFocus }"
              @click="emit('speak', card.word)"
            >
              <div class="wsc-top">
                <span class="wsc-word russian-phonetic-text">{{ props.showStressMarks ? card.stressedWord : card.word }}</span>
                <span v-if="card.isSentenceFocus" class="focus-dot-badge">ИК</span>
              </div>

              <!-- Syllable Stress Bars -->
              <div class="syllable-bars-row">
                <div
                  v-for="(syl, sIdx) in card.syllables"
                  :key="`${syl.text}_${sIdx}`"
                  class="syllable-step"
                  :class="{
                    'is-stressed': syl.stressed,
                    'is-reduced': !syl.stressed && syl.reduced,
                  }"
                >
                  <div class="syl-bar-track">
                    <span class="syl-bar-fill" />
                  </div>
                  <span class="syl-text">{{ syl.text }}</span>
                  <span v-if="syl.phonetic" class="syl-phonetic">[{{ syl.phonetic }}]</span>
                </div>
              </div>

              <span v-if="card.ipa" class="wsc-ipa russian-phonetic-text">{{ card.ipa }}</span>
              <span v-if="card.reductionNote" class="wsc-note" :title="card.reductionNote">
                {{ card.reductionNote }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Phonetic Rules (Akanie, Devoicing, Palatalization) -->
    <div class="rules-block">
      <div class="sub-label">
        {{ t('plugins.russian-analyzer.phoneticRulesLabel') }}
      </div>

      <div v-if="props.phonetics.phoneticRules.length === 0" class="no-rules-msg">
        {{ t('plugins.russian-analyzer.noPhoneticRules') }}
      </div>

      <div v-else class="rules-grid">
        <div
          v-for="(rule, idx) in props.phonetics.phoneticRules"
          :key="`${rule.title}_${idx}`"
          class="phonetic-rule-card"
        >
          <div class="pr-title">
            {{ rule.title }}
          </div>
          <div class="pr-transform">
            <span class="pr-written">{{ rule.written }}</span>
            <Icon icon="mdi:arrow-right" class="pr-arrow" />
            <span class="pr-spoken">{{ rule.spoken }}</span>
          </div>
          <p class="pr-explanation">
            {{ rule.explanation }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.phonetics-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
  border-radius: 22px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 0;
    border-radius: 0;
    background: transparent;
    border: none;
    gap: 10px;
  }
}

.section-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  @include media-down(sm) {
    gap: 9px;
  }

  .header-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
    font-size: 1.35rem;
    flex-shrink: 0;

    @include media-down(sm) {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      font-size: 1.1rem;
    }
  }

  .section-title {
    margin: 0 0 2px;
    font-size: 1.12rem;
    font-weight: 800;
    color: var(--fg-primary-color);

    @include media-down(sm) {
      font-size: 0.98rem;
    }
  }

  .section-subtitle {
    margin: 0;
    font-size: 0.82rem;
    color: var(--fg-secondary-color);

    @include media-down(sm) {
      font-size: 0.74rem;
    }
  }
}

.sub-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fg-secondary-color);
  margin-bottom: 8px;

  @include media-down(sm) {
    font-size: 0.68rem;
    margin-bottom: 6px;
  }
}

.ik-banner {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 13px 16px;
  border-radius: 15px;
  background: rgba(var(--fg-accent-color-rgb), 0.08);
  border: 1px solid rgba(var(--fg-accent-color-rgb), 0.25);

  @include media-down(sm) {
    padding: 10px 12px;
    border-radius: 13px;
  }

  .ik-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ik-label {
    margin-bottom: 0;
  }

  .ik-pill {
    padding: 3px 10px;
    border-radius: 8px;
    background: var(--fg-accent-color);
    color: #ffffff;
    font-size: 0.76rem;
    font-weight: 800;
  }

  .ik-desc {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.48;
    color: var(--fg-primary-color);
  }
}

.rhythm-block,
.stress-block {
  padding: 14px 16px;
  border-radius: 15px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 10px 12px;
    border-radius: 13px;
    background: var(--bg-secondary-color);
  }
}

.rhythm-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rhythm-track {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  @include media-down(sm) {
    gap: 6px;
  }
}

.row-index-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  background: rgba(var(--fg-accent-color-rgb), 0.14);
  color: var(--fg-accent-color);
  font-size: 0.7rem;
  font-weight: 800;
  flex-shrink: 0;
}

.rhythm-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 11px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 0.96rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    color: var(--fg-accent-color);
  }

  .r-icon {
    font-size: 0.95rem;
    color: var(--fg-accent-color);
  }

  @include media-down(sm) {
    padding: 5px 9px;
    font-size: 0.86rem;
    border-radius: 9px;
    background: var(--bg-primary-color);
  }
}

.pause-slash {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--fg-accent-color);
  opacity: 0.75;
}

.intonation-note {
  margin: 10px 0 0;
  font-size: 0.84rem;
  line-height: 1.45;
  color: var(--fg-secondary-color);

  @include media-down(sm) {
    margin: 7px 0 0;
    font-size: 0.78rem;
  }
}

.stress-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;

  .sub-label {
    margin-bottom: 0;
  }
}

.stress-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.legend-chip {
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 0.68rem;
  font-weight: 700;

  &.chip-stressed {
    background: rgba(var(--fg-accent-color-rgb), 0.15);
    color: var(--fg-accent-color);
  }

  &.chip-reduced {
    background: rgba(59, 130, 246, 0.14);
    color: #3b82f6;
  }

  &.chip-focus {
    background: rgba(245, 158, 11, 0.15);
    color: #d97706;
  }
}

.stress-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stress-sentence-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;

  & + .stress-sentence-row {
    padding-top: 10px;
    border-top: 1px dashed var(--border-secondary-color);
  }
}

.stress-row-badge {
  margin-top: 8px;
}

.stress-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  flex: 1;
  min-width: 0;

  @include media-down(sm) {
    gap: 7px;
  }
}

.word-stress-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 112px;
  padding: 10px 12px;
  border-radius: 13px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    transform: translateY(-2px);
  }

  &.is-focus {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.08);
  }

  @include media-down(sm) {
    min-width: 96px;
    padding: 8px 10px;
    border-radius: 11px;
    background: var(--bg-primary-color);
  }

  .wsc-top {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .wsc-word {
    font-size: 0.96rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .focus-dot-badge {
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.6rem;
    font-weight: 800;
    background: #f59e0b;
    color: #ffffff;
  }

  .wsc-ipa {
    font-size: 0.7rem;
    color: var(--fg-secondary-color);
  }

  .wsc-note {
    font-size: 0.64rem;
    color: var(--fg-tertiary-color);
    text-align: center;
    max-width: 130px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.syllable-bars-row {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  padding-top: 4px;
}

.syllable-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;

  .syl-bar-track {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    width: 20px;
    height: 28px;
  }

  .syl-bar-fill {
    width: 100%;
    height: 11px;
    border-radius: 5px;
    background: var(--border-primary-color);
  }

  &.is-stressed {
    .syl-bar-fill {
      height: 28px;
      background: linear-gradient(180deg, var(--fg-accent-color) 0%, #f59e0b 100%);
    }

    .syl-text {
      color: var(--fg-accent-color);
      font-weight: 800;
    }
  }

  &.is-reduced {
    .syl-bar-fill {
      height: 8px;
      background: rgba(59, 130, 246, 0.55);
    }

    .syl-phonetic {
      color: #3b82f6;
    }
  }

  .syl-text {
    font-size: 0.76rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .syl-phonetic {
    font-family: monospace;
    font-size: 0.62rem;
    color: var(--fg-tertiary-color);
  }
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.phonetic-rule-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bg-secondary-color);
  }

  .pr-title {
    font-size: 0.86rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .pr-transform {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    flex-wrap: wrap;
  }

  .pr-written {
    color: var(--fg-tertiary-color);
  }

  .pr-arrow {
    color: var(--fg-accent-color);
  }

  .pr-spoken {
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
    font-family: monospace;
  }

  .pr-explanation {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--fg-secondary-color);
  }
}

.no-rules-msg {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 0.84rem;
}
</style>
