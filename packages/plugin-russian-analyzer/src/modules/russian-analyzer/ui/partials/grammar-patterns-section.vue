<script setup lang="ts">
import type { GrammarPatternItem } from '../../model'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

interface Props {
  patterns: GrammarPatternItem[]
  showStressMarks: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  speak: [text: string]
  analyzeQuery: [text: string]
}>()

const { t } = useI18n()
</script>

<template>
  <section class="grammar-section">
    <header class="section-header">
      <div class="header-icon-box">
        <Icon icon="mdi:school-outline" />
      </div>
      <div class="header-titles">
        <h3 class="section-title">
          {{ t('plugins.russian-analyzer.grammarSectionTitle') }}
        </h3>
        <p class="section-subtitle">
          {{ t('plugins.russian-analyzer.grammarSectionSubtitle') }}
        </p>
      </div>
    </header>

    <div class="patterns-grid">
      <article
        v-for="pat in props.patterns"
        :key="pat.id"
        class="pattern-card"
      >
        <div class="pattern-top">
          <h4 class="pattern-name">
            {{ pat.name }}
          </h4>
          <span class="pattern-level">{{ pat.level }}</span>
        </div>

        <div v-if="pat.formula" class="formula-banner">
          <span class="formula-tag">{{ t('plugins.russian-analyzer.formulaLabel') }}:</span>
          <code class="formula-code">{{ pat.formula }}</code>
        </div>

        <p class="pattern-explanation">
          {{ pat.explanation }}
        </p>

        <div v-if="pat.commonMistakes" class="mistakes-alert">
          <div class="alert-title">
            <Icon icon="mdi:alert-circle-outline" />
            <span>{{ t('plugins.russian-analyzer.commonMistakesLabel') }}</span>
          </div>
          <p>{{ pat.commonMistakes }}</p>
        </div>

        <div v-if="pat.examples.length > 0" class="examples-block">
          <span class="examples-label">{{ t('plugins.russian-analyzer.examplesLabel') }}</span>
          <div class="examples-list">
            <div
              v-for="(ex, idx) in pat.examples"
              :key="`${ex.text}_${idx}`"
              class="example-row"
            >
              <div class="ex-text">
                <span class="ex-ru">{{ props.showStressMarks ? ex.stressedText : ex.text }}</span>
                <span class="ex-trans">{{ ex.translation }}</span>
              </div>

              <div class="ex-actions">
                <button
                  type="button"
                  class="ex-btn"
                  @click="emit('speak', ex.text)"
                >
                  <Icon icon="mdi:volume-medium" />
                </button>
                <button
                  type="button"
                  class="ex-btn"
                  :title="t('plugins.russian-analyzer.analyzeThisWord')"
                  @click="emit('analyzeQuery', ex.text)"
                >
                  <Icon icon="mdi:auto-fix" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.grammar-section {
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
    background: rgba(59, 130, 246, 0.14);
    color: #3b82f6;
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

.patterns-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
    gap: 10px;
  }
}

.pattern-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border-radius: 16px;
  background: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 12px;
    gap: 9px;
    border-radius: 14px;
    background: var(--bg-secondary-color);
  }
}

.pattern-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;

  .pattern-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    color: var(--fg-primary-color);
    line-height: 1.35;
  }

  .pattern-level {
    padding: 3px 9px;
    border-radius: 7px;
    font-size: 0.72rem;
    font-weight: 700;
    background: rgba(var(--fg-accent-color-rgb), 0.14);
    color: var(--fg-accent-color);
    flex-shrink: 0;
  }
}

.formula-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 11px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  flex-wrap: wrap;

  @include media-down(sm) {
    padding: 7px 10px;
    background: var(--bg-primary-color);
  }

  .formula-tag {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-secondary-color);
  }

  .formula-code {
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--fg-accent-color);
  }
}

.pattern-explanation {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--fg-primary-color);
}

.mistakes-alert {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 11px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);

  .alert-title {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #ef4444;
  }

  p {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--fg-primary-color);
  }
}

.examples-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;

  .examples-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--fg-tertiary-color);
  }
}

.examples-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 11px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);

  @include media-down(sm) {
    padding: 8px 10px;
    background: var(--bg-primary-color);
  }

  .ex-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ex-ru {
    font-size: 0.94rem;
    font-weight: 700;
    color: var(--fg-primary-color);
  }

  .ex-trans {
    font-size: 0.8rem;
    color: var(--fg-secondary-color);
  }

  .ex-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .ex-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid var(--border-secondary-color);
    background: var(--bg-primary-color);
    color: var(--fg-secondary-color);
    cursor: pointer;

    &:hover {
      border-color: var(--fg-accent-color);
      color: var(--fg-accent-color);
    }
  }
}
</style>
