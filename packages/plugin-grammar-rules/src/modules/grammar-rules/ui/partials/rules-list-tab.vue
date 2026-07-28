<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitInput, KitSelect } from '~/components/01.kit'
import { Icon } from '@iconify/vue'
import type { Rule } from '@injurka/insight-book-plugin-grammar-rules/shared/types'
import RuleCard from './rule-card.vue'

interface Props {
  filteredRules: Rule[]
  loading?: boolean
}

defineProps<Props>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const selectedCategory = defineModel<string>('selectedCategory', { required: true })
const selectedLevel = defineModel<string>('selectedLevel', { required: true })

const { t } = useI18n()

const categoryOptions = computed(() => [
  { label: t('plugins.grammar-rules.catAll'), value: 'all' },
  { label: t('plugins.grammar-rules.catGrammar'), value: 'grammar' },
  { label: t('plugins.grammar-rules.catLexical'), value: 'lexical' },
  { label: t('plugins.grammar-rules.catCollocation'), value: 'collocation' },
  { label: t('plugins.grammar-rules.catMeasureWords'), value: 'measure_words' }
])

const levelOptions = computed(() => [
  { label: t('plugins.grammar-rules.levelAll'), value: 'all' },
  { label: 'HSK 1', value: 'hsk1' },
  { label: 'HSK 2', value: 'hsk2' },
  { label: 'HSK 3', value: 'hsk3' }
])
</script>

<template>
  <div class="rules-tab-content">
    <div class="filters-bar">
      <KitInput v-model="searchQuery" :placeholder="t('plugins.grammar-rules.searchPlaceholder')" class="search-input" />
      <KitSelect v-model="selectedCategory" :options="categoryOptions" class="category-select" />
      <KitSelect v-model="selectedLevel" :options="levelOptions" class="level-select" />
    </div>

    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="spin-icon" />
      <p>{{ t('plugins.grammar-rules.loadingRules') }}</p>
    </div>

    <div v-else-if="filteredRules.length === 0" class="empty-state">
      <Icon icon="mdi:book-open-blank-variant" class="empty-icon" />
      <p>{{ t('plugins.grammar-rules.rulesNotFound') }}</p>
    </div>

    <div v-else class="rules-grid">
      <RuleCard v-for="rule in filteredRules" :key="rule.id" :rule="rule" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rules-tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 12px;
}

.filters-bar {
  display: flex;
  gap: 16px;
  width: 100%;

  .search-input {
    flex: 1;
  }

  .category-select, .level-select {
    width: 200px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    .category-select, .level-select {
      width: 100%;
    }
  }
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
  color: var(--fg-secondary-color);
  gap: 16px;

  .spin-icon {
    font-size: 2.5rem;
    animation: spin 1s linear infinite;
  }

  .empty-icon {
    font-size: 3rem;
    color: var(--border-primary-color);
  }

  p {
    margin: 0;
    max-width: 400px;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
</style>
