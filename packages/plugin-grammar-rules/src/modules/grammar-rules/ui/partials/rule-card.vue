<script setup lang="ts">
import type { Rule } from '~plugin-grammar-rules/shared/types'

interface Props {
  rule: Rule
}

defineProps<Props>()

const categoryLabel = (cat: string) => {
  switch (cat) {
    case 'grammar': return 'Грамматика'
    case 'lexical': return 'Лексика'
    case 'collocation': return 'Коллокация'
    case 'measure_words': return 'Счетное слово'
    default: return cat
  }
}
</script>

<template>
  <div class="rule-card">
    <div class="card-header">
      <div class="badges">
        <span class="category-badge" :class="rule.category">{{ categoryLabel(rule.category) }}</span>
        <span class="category-badge hsk-badge">{{ rule.hskLevel.toUpperCase() }}</span>
      </div>
      <h3 class="rule-title">{{ rule.title }}</h3>
      <code v-if="rule.pattern" class="rule-pattern">{{ rule.pattern }}</code>
    </div>
    
    <p class="rule-desc">{{ rule.description }}</p>

    <div class="rule-examples">
      <ol class="examples-list">
        <li v-for="(ex, index) in rule.examples" :key="index" class="example-item">
          <div class="example-index">{{ index + 1 }}</div>
          <div class="example-content">
            <span class="example-sentence">{{ ex.sentence }}</span>
            <span v-if="ex.pinyin" class="example-pinyin">{{ ex.pinyin }}</span>
            <span class="example-translation">{{ ex.translation }}</span>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rule-card {
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    border-color: var(--border-secondary-color);
  }
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.badges {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.category-badge {
  align-self: flex-start;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  &.grammar {
    background-color: var(--bg-accent-color);
    color: var(--fg-accent-color);
  }

  &.lexical {
    background-color: var(--bg-success-color);
    color: var(--fg-success-color);
  }

  &.collocation {
    background-color: var(--bg-error-color);
    color: var(--fg-error-color);
  }

  &.measure_words {
    background-color: var(--bg-warning-color);
    color: var(--fg-warning-color);
  }

  &.hsk-badge {
    background-color: var(--bg-info-color);
    color: var(--fg-info-color);
  }
}

.rule-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  margin: 0;
}

.rule-pattern {
  align-self: flex-start;
  background: var(--bg-tertiary-color);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--fg-accent-color);
  font-family: monospace;
}

.rule-desc {
  font-size: 0.95rem;
  color: var(--fg-secondary-color);
  line-height: 1.5;
  margin: 0;
  flex-grow: 1;
}

.rule-examples {
  border-top: 1px solid var(--border-secondary-color);
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.examples-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-item {
  position: relative;
  padding: 10px 36px 10px 12px;
  background-color: var(--bg-primary-color);
  border-radius: 8px;
  border-left: 3px solid var(--border-accent-color);
}

.example-index {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: var(--bg-accent-color);
  color: var(--fg-accent-color);
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.example-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.example-sentence {
  font-size: 1rem;
  font-weight: 600;
  color: var(--fg-primary-color);
  line-height: 1.4;
}

.example-pinyin {
  font-size: 0.8rem;
  font-style: italic;
  color: var(--fg-accent-color);
  letter-spacing: 0.3px;
}

.example-translation {
  font-size: 0.82rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
}
</style>
