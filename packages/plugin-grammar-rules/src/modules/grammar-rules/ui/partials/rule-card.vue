<script setup lang="ts">
import type { Rule, RuleTest } from '../../../../shared/types'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'
import { useAiGrammar } from '../../composables/use-ai-grammar'

interface Props {
  rule: Rule
  mastery?: 'new' | 'learning' | 'review' | 'mastered'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'generateTest', tests: RuleTest[]): void
  (e: 'learnMore', rule: Rule): void
  (e: 'practiceRule', rule: Rule): void
}>()

const { t, te } = useI18n()
const { isGenerating, generateTestsForRule } = useAiGrammar()

const isExpandedExamples = ref(false)
const categoryFallbackKeys: Record<string, string> = {
  grammar: 'plugins.grammar-rules.catGrammar',
  tenses: 'plugins.grammar-rules.catTenses',
  modals: 'plugins.grammar-rules.catModals',
  conditionals: 'plugins.grammar-rules.catConditionals',
  passive: 'plugins.grammar-rules.catPassive',
  articles: 'plugins.grammar-rules.catArticles',
  lexical: 'plugins.grammar-rules.catLexical',
  collocation: 'plugins.grammar-rules.catCollocation',
  measure_words: 'plugins.grammar-rules.catMeasureWords',
}

const levelLabel = computed(() => {
  return (props.rule.level || props.rule.hskLevel || '').toUpperCase()
})
const remainingExamplesCount = computed(() => {
  return (props.rule.examples?.length || 0) - 1
})

async function onGenerateAiTest() {
  const generated = await generateTestsForRule(props.rule)

  if (generated && generated.length > 0) {
    emit('generateTest', generated)
  }
}
function categoryLabel(cat: string) {
  const i18nKey = `plugins.grammar-rules.cat_${cat}`

  if (te(i18nKey))
    return t(i18nKey)

  const fallbackKey = categoryFallbackKeys[cat]

  return fallbackKey ? t(fallbackKey) : cat
}
function masteryLabel(m: string) {
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
    <!-- Header: Level, Category & Mastery -->
    <div class="card-header">
      <div class="meta-tags">
        <span v-if="levelLabel" class="level-badge">
          {{ levelLabel }}
        </span>
        <span class="category-badge" :class="rule.category">
          {{ categoryLabel(rule.category) }}
        </span>
      </div>

      <div
        v-if="mastery"
        class="mastery-indicator"
        :class="mastery"
        :title="t('plugins.grammar-rules.masteryStatus')"
      >
        <span class="status-dot" />
        <span class="status-text">{{ masteryLabel(mastery) }}</span>
      </div>
    </div>

    <!-- Rule Title & Syntax Pattern -->
    <div class="card-main">
      <h3 class="rule-title">
        {{ rule.title }}
      </h3>

      <div v-if="rule.pattern" class="pattern-banner">
        <span class="pattern-label">{{ t('plugins.grammar-rules.ruleFormula') }}:</span>
        <code class="pattern-code">{{ rule.pattern }}</code>
      </div>

      <p class="rule-description">
        {{ rule.description }}
      </p>
    </div>

    <!-- Examples preview section -->
    <div v-if="rule.examples && rule.examples.length > 0" class="examples-section">
      <!-- Primary Example -->
      <div class="example-item primary">
        <div class="example-body">
          <span class="example-sentence">{{ rule.examples[0].sentence }}</span>
          <span v-if="rule.examples[0].phonetic || rule.examples[0].pinyin" class="example-phonetic">
            {{ rule.examples[0].phonetic || rule.examples[0].pinyin }}
          </span>
          <span class="example-translation">{{ rule.examples[0].translation }}</span>
        </div>
      </div>

      <!-- Additional Examples Expandable Drawer -->
      <div v-if="remainingExamplesCount > 0" class="additional-examples">
        <div v-if="isExpandedExamples" class="expanded-list">
          <div
            v-for="(ex, index) in rule.examples.slice(1)"
            :key="index"
            class="example-item"
          >
            <div class="example-body">
              <span class="example-sentence">{{ ex.sentence }}</span>
              <span v-if="ex.phonetic || ex.pinyin" class="example-phonetic">
                {{ ex.phonetic || ex.pinyin }}
              </span>
              <span class="example-translation">{{ ex.translation }}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="examples-toggle-btn"
          @click="isExpandedExamples = !isExpandedExamples"
        >
          <span>
            {{ isExpandedExamples
              ? t('plugins.grammar-rules.collapseExamples')
              : (remainingExamplesCount === 1
                ? t('plugins.grammar-rules.moreExamples', { count: 1 })
                : t('plugins.grammar-rules.moreExamplesPlural', { count: remainingExamplesCount }))
            }}
          </span>
          <Icon :icon="isExpandedExamples ? 'mdi:chevron-up' : 'mdi:chevron-down'" />
        </button>
      </div>
    </div>

    <!-- Action Bar -->
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
        icon="mdi:lightning-bolt"
        @click="emit('practiceRule', rule)"
      >
        {{ t('plugins.grammar-rules.practiceRule') }}
      </KitBtn>

      <KitBtn
        size="xs"
        variant="text"
        color="secondary"
        :loading="isGenerating"
        icon="mdi:creation-outline"
        class="ai-quiz-btn"
        :title="t('plugins.grammar-rules.generateAiTests')"
        @click="onGenerateAiTest"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rule-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);

  &:hover {
    border-color: var(--border-secondary-color);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
    transform: translateY(-2px);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.meta-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.level-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  background-color: rgba(var(--fg-accent-color-rgb, 120, 100, 240), 0.14);
  color: var(--fg-accent-color);
}

.category-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: var(--bg-hover-color);
  color: var(--fg-secondary-color);
  border: 1px solid var(--border-primary-color);
}

.mastery-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  &.new {
    color: var(--fg-secondary-color);
    .status-dot {
      background-color: var(--fg-secondary-color);
    }
  }

  &.learning {
    color: var(--fg-warning-color);
    background-color: rgba(241, 196, 15, 0.12);
    .status-dot {
      background-color: var(--fg-warning-color);
    }
  }

  &.review {
    color: #e67e22;
    background-color: rgba(230, 126, 34, 0.12);
    .status-dot {
      background-color: #e67e22;
    }
  }

  &.mastered {
    color: var(--fg-success-color);
    background-color: rgba(46, 204, 113, 0.12);
    .status-dot {
      background-color: var(--fg-success-color);
    }
  }
}

.card-main {
  display: flex;
  flex-direction: column;
  gap: 10px;

  .rule-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    line-height: 1.35;
  }

  .pattern-banner {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 8px;
    background-color: var(--bg-hover-color);
    border: 1px solid var(--border-primary-color);
    font-size: 0.82rem;

    .pattern-label {
      font-weight: 600;
      color: var(--fg-secondary-color);
    }

    .pattern-code {
      font-family: var(--font-mono, monospace);
      font-weight: 700;
      color: var(--fg-accent-color);
    }
  }

  .rule-description {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.5;
    color: var(--fg-secondary-color);
  }
}

.examples-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-primary-color);
}

.example-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  border-radius: 10px;
  background-color: var(--bg-hover-color);

  .example-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .example-sentence {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }

  .example-phonetic {
    font-size: 0.8rem;
    color: var(--fg-accent-color);
  }

  .example-translation {
    font-size: 0.85rem;
    color: var(--fg-secondary-color);
  }
}

.additional-examples {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .expanded-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: fade-in 0.2s ease;
  }

  .examples-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    align-self: flex-start;
    padding: 4px 6px;
    border: none;
    background: transparent;
    color: var(--fg-secondary-color);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border-radius: 6px;
    transition: color 0.15s ease;

    &:hover {
      color: var(--fg-accent-color);
    }
  }
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;

  .ai-quiz-btn {
    margin-left: auto;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
