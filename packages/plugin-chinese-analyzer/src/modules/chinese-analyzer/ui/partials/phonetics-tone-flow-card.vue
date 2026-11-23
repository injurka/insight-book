<script setup lang="ts">
import type { PhoneticsAnalysis, SyllableTonePoint } from '../../model'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getTonePitchTriplet } from '../../../../shared/lib/tone-utils'

interface Props {
  phonetics: PhoneticsAnalysis
}

const props = defineProps<Props>()

const emit = defineEmits<{
  speak: [text: string]
}>()

const { t } = useI18n()

const rhythmSegments = computed(() => {
  return props.phonetics.rhythmGrouping
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
})

function pitchToY(pitch: number): number {
  const clamped = Math.min(5, Math.max(1, pitch))

  return 56 - ((clamped - 1) / 4) * 44
}

function getSyllableCurvePath(syllable: SyllableTonePoint): string {
  const [pStart, pMid, pEnd] = getTonePitchTriplet(syllable.spokenTone)
  const y1 = pitchToY(pStart)
  const y2 = pitchToY(pMid)
  const y3 = pitchToY(pEnd)

  return `M 10 ${y1} Q 36 ${y2} 62 ${y3}`
}

function getSyllableEndPoint(syllable: SyllableTonePoint): { x: number, y: number } {
  const [, , pEnd] = getTonePitchTriplet(syllable.spokenTone)

  return { x: 62, y: pitchToY(pEnd) }
}
</script>

<template>
  <section class="phonetics-card">
    <header class="section-header">
      <div class="header-icon-box">
        <Icon icon="mdi:waveform" />
      </div>
      <div class="header-titles">
        <h3 class="section-title">
          {{ t('plugins.chinese-analyzer.phoneticsSectionTitle') }}
        </h3>
        <p class="section-subtitle">
          {{ t('plugins.chinese-analyzer.phoneticsSectionSubtitle') }}
        </p>
      </div>
    </header>

    <!-- Prosodic Rhythm & Pauses -->
    <div class="rhythm-block">
      <div class="sub-label">
        {{ t('plugins.chinese-analyzer.rhythmGroupingLabel') }}
      </div>
      <div class="rhythm-track">
        <template v-for="(seg, idx) in rhythmSegments" :key="`${seg}_${idx}`">
          <button
            type="button"
            class="rhythm-pill"
            @click="emit('speak', seg)"
          >
            <Icon icon="mdi:volume-medium" class="r-icon" />
            <span>{{ seg }}</span>
          </button>
          <span v-if="idx < rhythmSegments.length - 1" class="pause-slash">/</span>
        </template>
      </div>
      <p v-if="props.phonetics.intonationNote" class="intonation-note">
        {{ props.phonetics.intonationNote }}
      </p>
    </div>

    <!-- Visual Tone Pitch Contour Chart (Chao 1-5 Scale) -->
    <div class="contour-block">
      <div class="sub-label">
        {{ t('plugins.chinese-analyzer.toneContourLabel') }}
      </div>

      <div class="contour-scroll">
        <div
          v-for="(syl, idx) in props.phonetics.syllables"
          :key="`${syl.hanzi}_${idx}`"
          class="syllable-contour-cell"
          :class="{ 'has-sandhi': syl.sandhiApplied }"
          @click="emit('speak', syl.hanzi)"
        >
          <div class="syl-top">
            <span class="syl-pinyin" :class="`tone-color-${syl.spokenTone}`">{{ syl.pinyin }}</span>
            <span v-if="syl.sandhiApplied" class="sandhi-badge">变调</span>
          </div>

          <svg class="tone-mini-svg" viewBox="0 0 72 68">
            <line
              x1="6"
              y1="12"
              x2="66"
              y2="12"
              class="pitch-grid-line"
            />
            <line
              x1="6"
              y1="34"
              x2="66"
              y2="34"
              class="pitch-grid-line"
            />
            <line
              x1="6"
              y1="56"
              x2="66"
              y2="56"
              class="pitch-grid-line"
            />

            <path
              :d="getSyllableCurvePath(syl)"
              class="tone-curve-path"
              :class="`tone-stroke-${syl.spokenTone}`"
            />

            <circle
              :cx="getSyllableEndPoint(syl).x"
              :cy="getSyllableEndPoint(syl).y"
              r="3.8"
              class="tone-end-dot"
              :class="`tone-fill-${syl.spokenTone}`"
            />
          </svg>

          <span class="syl-hanzi">{{ syl.hanzi }}</span>
          <span v-if="syl.note" class="syl-note">{{ syl.note }}</span>
        </div>
      </div>
    </div>

    <!-- Tone Sandhi Rules -->
    <div class="sandhi-rules-block">
      <div class="sub-label">
        {{ t('plugins.chinese-analyzer.sandhiRulesLabel') }}
      </div>

      <div v-if="props.phonetics.sandhiRules.length === 0" class="no-sandhi-msg">
        {{ t('plugins.chinese-analyzer.noSandhiRules') }}
      </div>

      <div v-else class="sandhi-grid">
        <div
          v-for="(rule, idx) in props.phonetics.sandhiRules"
          :key="`${rule.title}_${idx}`"
          class="sandhi-rule-card"
        >
          <div class="sr-title">
            {{ rule.title }}
          </div>
          <div class="sr-transform">
            <span class="sr-before">{{ rule.before }}</span>
            <Icon icon="mdi:arrow-right" class="sr-arrow" />
            <span class="sr-after">{{ rule.after }}</span>
          </div>
          <p class="sr-explanation">
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
  gap: 18px;
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

.rhythm-block {
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

.rhythm-track {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;

  @include media-down(sm) {
    gap: 6px;
  }
}

.rhythm-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-radius: 11px;
  border: 1px solid var(--border-secondary-color);
  background: var(--bg-secondary-color);
  color: var(--fg-primary-color);
  font-family: inherit;
  font-size: 1.05rem;
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
    font-size: 0.92rem;
    border-radius: 9px;
    background: var(--bg-primary-color);
  }
}

.pause-slash {
  font-size: 1.2rem;
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

.contour-block {
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

.contour-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;

  @include media-down(sm) {
    gap: 6px;
  }
}

.syllable-contour-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 82px;
  padding: 8px 6px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: var(--fg-accent-color);
    transform: translateY(-2px);
  }

  &.has-sandhi {
    border-color: rgba(var(--fg-accent-color-rgb), 0.45);
    background: rgba(var(--fg-accent-color-rgb), 0.05);
  }

  .syl-top {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .syl-pinyin {
    font-size: 0.78rem;
    font-weight: 700;
  }

  .sandhi-badge {
    padding: 0 4px;
    border-radius: 4px;
    font-size: 0.58rem;
    font-weight: 700;
    background: var(--fg-accent-color);
    color: #ffffff;
  }

  .syl-hanzi {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .syl-note {
    font-size: 0.62rem;
    color: var(--fg-tertiary-color);
    text-align: center;
    max-width: 78px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @include media-down(sm) {
    min-width: 68px;
    padding: 6px 4px;
    border-radius: 10px;
    background: var(--bg-primary-color);

    .syl-pinyin {
      font-size: 0.7rem;
    }

    .syl-hanzi {
      font-size: 1.1rem;
    }
  }
}

.tone-mini-svg {
  width: 68px;
  height: 56px;
}

.pitch-grid-line {
  stroke: var(--border-primary-color);
  stroke-width: 1px;
  stroke-dasharray: 2 2;
  opacity: 0.55;
}

.tone-curve-path {
  fill: none;
  stroke-width: 3px;
  stroke-linecap: round;
}

.tone-color-1,
.tone-stroke-1 {
  color: #ef4444;
  stroke: #ef4444;
}

.tone-fill-1 {
  fill: #ef4444;
}

.tone-color-2,
.tone-stroke-2 {
  color: #f59e0b;
  stroke: #f59e0b;
}

.tone-fill-2 {
  fill: #f59e0b;
}

.tone-color-3,
.tone-stroke-3 {
  color: #10b981;
  stroke: #10b981;
}

.tone-fill-3 {
  fill: #10b981;
}

.tone-color-4,
.tone-stroke-4 {
  color: #3b82f6;
  stroke: #3b82f6;
}

.tone-fill-4 {
  fill: #3b82f6;
}

.tone-color-5,
.tone-stroke-5 {
  color: var(--fg-secondary-color);
  stroke: var(--fg-secondary-color);
}

.tone-fill-5 {
  fill: var(--fg-secondary-color);
}

.sandhi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.sandhi-rule-card {
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

  .sr-title {
    font-size: 0.86rem;
    font-weight: 800;
    color: var(--fg-primary-color);
  }

  .sr-transform {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .sr-before {
    color: var(--fg-tertiary-color);
    text-decoration: line-through;
  }

  .sr-arrow {
    color: var(--fg-accent-color);
  }

  .sr-after {
    padding: 2px 7px;
    border-radius: 6px;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
  }

  .sr-explanation {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--fg-secondary-color);
  }
}

.no-sandhi-msg {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 0.84rem;
}
</style>
