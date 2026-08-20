<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'
import type { Rule, RuleTest } from '../../../../shared/types'
import { useAiGrammar } from '../../composables/use-ai-grammar'

interface Props {
  rule: Rule
  mastery?: 'new' | 'learning' | 'review' | 'mastered'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'generateTest', tests: RuleTest[]): void
  (e: 'learnMore', rule: Rule): void
}>()

const { t, te } = useI18n()
const { isGenerating, generateTestsForRule } = useAiGrammar()

const onGenerateAiTest = async () => {
  const generated = await generateTestsForRule(props.rule)
  if (generated && generated.length > 0) {
    emit('generateTest', generated)
  }
}

const categoryLabel = (cat: string) => {
  const i18nKey = `plugins.grammar-rules.cat_${cat}`
  if (te(i18nKey))
    return t(i18nKey)

  switch (cat) {
    case 'grammar': return t('plugins.grammar-rules.catGrammar')
    case 'tenses': return t('plugins.grammar-rules.catTenses')
    case 'modals': return t('plugins.grammar-rules.catModals')
    case 'conditionals': return t('plugins.grammar-rules.catConditionals')
    case 'passive': return t('plugins.grammar-rules.catPassive')
    case 'articles': return t('plugins.grammar-rules.catArticles')
    case 'lexical': return t('plugins.grammar-rules.catLexical')
    case 'collocation': return t('plugins.grammar-rules.catCollocation')
    case 'measure_words': return t('plugins.grammar-rules.catMeasureWords')
    default: return cat
  }
}

const masteryLabel = (m: string) => {
  switch (m) {
    case 'new': return t('plugins.grammar-rules.masteryNew')
    case 'learning': return t('plugins.grammar-rules.masteryLearning')
    case 'review': return t('plugins.grammar-rules.masteryReview')
    case 'mastered': return t('plugins.grammar-rules.masteryMastered')
    default: return m
  }
}
</script>

<template>
  <div class="rule-card">
    <div class="card-header">
      <div class="badges">
        <span class="category-badge" :class="rule.category">{{ categoryLabel(rule.category) }}</span>
        <div class="level-badges">
          <span v-if="mastery" class="mastery-badge" :class="mastery">
            {{ masteryLabel(mastery) }}
          </span>
          <span class="category-badge level-badge">
            {{ (rule.level || rule.hskLevel || '').toUpperCase() }}
          </span>
        </div>
      </div>
      <h3 class="rule-title">
        {{ rule.title }}
      </h3>
      <code v-if="rule.pattern" class="rule-pattern">{{ rule.pattern }}</code>
    </div>

    <p class="rule-desc">
      {{ rule.description }}
    </p>

    <div v-if="rule.examples && rule.examples.length > 0" class="rule-examples">
      <ol class="examples-list">
        <li v-for="(ex, index) in rule.examples" :key="index" class="example-item">
          <div class="example-index">
            {{ index + 1 }}
          </div>
          <div class="example-content">
            <span class="example-sentence">{{ ex.sentence }}</span>
            <span v-if="ex.phonetic || ex.pinyin" class="example-phonetic">
              {{ ex.phonetic || ex.pinyin }}
            </span>
            <span class="example-translation">{{ ex.translation }}</span>
          </div>
        </li>
      </ol>
    </div>

    <div class="card-actions">
      <KitBtn
        size="xs"
        variant="tonal"
        color="secondary"
        icon="mdi:book-open-page-variant-outline"
        @click="emit('learnMore', rule)"
      >
        {{ t('plugins.grammar-rules.learnMore') }}
      </KitBtn>

      <KitBtn
        size="xs"
        variant="tonal"
        color="accent"
        :loading="isGenerating"
        icon="mdi:creation-outline"
        @click="onGenerateAiTest"
      >
        {{ isGenerating ? t('plugins.grammar-rules.generatingAiTests') : t('plugins.grammar-rules.generateAiTests') }}
      </KitBtn>
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

.level-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mastery-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 4px;
  text-transform: uppercase;

  &.new {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-secondary-color);
  }
  &.learning {
    background-color: rgba(255, 183, 77, 0.2);
    color: #ff9800;
  }
  &.review {
    background-color: rgba(100, 181, 246, 0.2);
    color: #2196f3;
  }
  &.mastered {
    background-color: rgba(129, 199, 132, 0.2);
    color: #4caf50;
  }
}

.category-badge {
  align-self: flex-start;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);

  &.grammar, &.tenses {
    background-color: rgba(100, 100, 255, 0.15);
    color: var(--fg-accent-color);
  }

  &.lexical, &.articles {
    background-color: rgba(76, 175, 80, 0.15);
    color: #4caf50;
  }

  &.collocation, &.passive {
    background-color: rgba(244, 67, 54, 0.15);
    color: #f44336;
  }

  &.measure_words, &.conditionals {
    background-color: rgba(255, 152, 0, 0.15);
    color: #ff9800;
  }

  &.modals {
    background-color: rgba(0, 188, 212, 0.15);
    color: #00bcd4;
  }

  &.level-badge {
    background-color: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
    font-weight: 700;
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

.example-phonetic {
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

.card-actions {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 4px;
}
</style>
