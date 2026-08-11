<script setup lang="ts">
import type { Highlight } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitDialog } from '~/02.kit/organisms/kit-dialog/ui'

interface Props {
  visible: boolean
  highlight: Highlight | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.visible,
  set: val => emit('update:visible', val),
})
</script>

<template>
  <KitDialog
    v-model:visible="isOpen"
    :title="t('analysis.aiAnalysis') || 'Глубокий анализ цитаты'"
    :max-width="800"
    icon="mdi:book-open-page-variant-outline"
  >
    <div v-if="highlight?.analysisData" class="quote-modal-content">
      <!-- Hero Section for Quote -->
      <div class="quote-hero">
        <Icon icon="mdi:format-quote-close" class="quote-bg-icon" />
        <div class="quote-text">
          {{ highlight.text }}
        </div>
        <div v-if="highlight.analysisData.transcription" class="quote-transcription">
          {{ highlight.analysisData.transcription }}
        </div>
        <div v-if="highlight.translation" class="quote-translation">
          {{ highlight.translation }}
        </div>
      </div>

      <!-- Analysis Details Grid -->
      <div class="analysis-grid">
        <!-- Grammar Column -->
        <div v-if="highlight.analysisData.grammarRules?.length" class="analysis-section grammar-section">
          <h3 class="section-title">
            <Icon icon="mdi:puzzle-outline" class="section-icon text-accent" />
            {{ t('analysis.grammar') || 'Грамматика' }}
          </h3>
          <div class="cards-list">
            <div v-for="(rule, idx) in highlight.analysisData.grammarRules" :key="idx" class="info-card grammar-card">
              <div class="rule-header">
                <span class="rule-pattern">{{ rule.pattern }}</span>
              </div>
              <div class="rule-explanation">
                {{ rule.explanation }}
              </div>
              <div v-if="rule.example" class="rule-example">
                <Icon icon="mdi:lightbulb-outline" class="example-icon" />
                <span>{{ rule.example }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Vocabulary Column -->
        <div v-if="highlight.analysisData.vocabulary?.length" class="analysis-section vocab-section">
          <h3 class="section-title">
            <Icon icon="mdi:text-box-search-outline" class="section-icon text-secondary" />
            {{ t('analysis.vocabulary') || 'Словарь' }}
          </h3>
          <div class="cards-list">
            <template v-for="(v, idx) in highlight.analysisData.vocabulary" :key="idx">
              <div v-if="v && v.word" class="info-card vocab-card">
                <div class="vocab-header">
                  <span class="vocab-word">{{ v.word }}</span>
                  <span v-if="v.transcription" class="vocab-transcription">[{{ v.transcription }}]</span>
                </div>
                <div class="vocab-meaning">
                  {{ v.meaning }}
                </div>
                <div v-if="v.usageInContext" class="vocab-context">
                  <Icon icon="mdi:format-quote-close" class="context-icon" />
                  <span>{{ v.usageInContext }}</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.quote-modal-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 8px 0;
}

/* Hero Section */
.quote-hero {
  position: relative;
  background: linear-gradient(
    135deg,
    rgba(var(--bg-tertiary-color-rgb, 33, 38, 45), 0.7),
    rgba(var(--bg-secondary-color-rgb, 40, 44, 52), 0.9)
  );
  border-radius: 16px;
  padding: 40px 32px;
  text-align: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);

  @include media-down(sm) {
    padding: 24px 16px;
  }
}

.quote-bg-icon {
  position: absolute;
  top: -20px;
  right: -10px;
  left: auto;
  font-size: 160px;
  color: var(--fg-accent-color);
  opacity: 0.08;
  pointer-events: none;
}

.quote-text {
  position: relative;
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin-bottom: 12px;
  line-height: 1.4;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);

  @include media-down(sm) {
    font-size: 1.4rem;
  }
}

.quote-transcription {
  position: relative;
  font-size: 1.1rem;
  color: var(--fg-secondary-color);
  margin-bottom: 24px;
  font-family: monospace;
  letter-spacing: 0.02em;
}

.quote-translation {
  position: relative;
  display: inline-block;
  background: rgba(var(--fg-accent-color-rgb, 255, 193, 7), 0.1);
  color: var(--fg-accent-color);
  padding: 10px 20px;
  border-radius: 24px;
  font-size: 1.05rem;
  font-weight: 500;
  border: 1px solid rgba(var(--fg-accent-color-rgb, 255, 193, 7), 0.2);
  box-shadow: 0 4px 12px rgba(var(--fg-accent-color-rgb, 255, 193, 7), 0.1);
}

/* Linear Layout */
.analysis-grid {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
  margin: 0 0 16px 0;
  color: var(--fg-primary-color);
  font-weight: 600;

  .section-icon {
    font-size: 1.5rem;
  }

  .text-accent {
    color: var(--fg-accent-color);
  }
  .text-secondary {
    color: var(--fg-secondary-color);
  }
}

.cards-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Minimalist List Styles */
.info-card {
  padding: 16px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: opacity 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    opacity: 0.9;
  }
}

/* Grammar List Specifics */
.grammar-card {
  border-left: none;
}

.rule-header {
  margin-bottom: 8px;
}

.rule-pattern {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--fg-primary-color);
}

.rule-explanation {
  font-size: 1rem;
  color: var(--fg-secondary-color);
  line-height: 1.6;
  margin-bottom: 12px;
}

.rule-example {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.95rem;
  color: var(--fg-muted-color);
  font-style: italic;
  border-left: 2px solid var(--fg-accent-color);
  padding-left: 12px;

  .example-icon {
    display: none;
  }
}

/* Vocabulary List Specifics */
.vocab-card {
  border-left: none;
}

.vocab-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 6px;
}

.vocab-word {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--fg-primary-color);
}

.vocab-transcription {
  font-size: 0.95rem;
  color: var(--fg-muted-color);
  font-family: monospace;
}

.vocab-meaning {
  font-size: 1rem;
  color: var(--fg-primary-color);
  margin-bottom: 8px;
}

.vocab-context {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
  background: rgba(0, 0, 0, 0.1);
  padding: 10px 12px;
  border-radius: 6px;

  .context-icon {
    font-size: 1.1rem;
    flex-shrink: 0;
    opacity: 0.5;
    margin-top: 1px;
  }
}
</style>
