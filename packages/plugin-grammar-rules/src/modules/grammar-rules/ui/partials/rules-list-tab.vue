<script setup lang="ts">
import type { GrammarMasteryLevel, Rule, RuleTest } from '../../../../shared/types'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitInput } from '~/02.kit'
import { useRuleDetails } from '../../composables/use-rule-details'
import RuleCard from './rule-card.vue'
import RuleDetailsModal from './rule-details-modal.vue'

interface OptionItem {
  label: string
  value: string
  count?: number
  color?: string
}

interface Props {
  filteredRules: Rule[]
  categoryOptions: OptionItem[]
  levelOptions: OptionItem[]
  totalRulesCount?: number
  loading?: boolean
  getRuleMastery?: (ruleId: string) => GrammarMasteryLevel
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'addTests', tests: RuleTest[]): void
  (e: 'practiceRule', rule: Rule): void
}>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const selectedCategory = defineModel<string>('selectedCategory', { required: true })
const selectedLevel = defineModel<string>('selectedLevel', { required: true })

const { t } = useI18n()
const {
  selectedRule,
  isModalOpen,
  explanation,
  isLoading: isExplanationLoading,
  error: explanationError,
  openRuleDetails,
  regenerate: regenerateExplanation,
} = useRuleDetails()

const isAnyFilterActive = computed(() => {
  return Boolean(searchQuery.value.trim()) || selectedCategory.value !== 'all' || selectedLevel.value !== 'all'
})

function onResetFilters() {
  searchQuery.value = ''
  selectedCategory.value = 'all'
  selectedLevel.value = 'all'
}

function onPracticeRule(rule: Rule) {
  emit('practiceRule', rule)
}
</script>

<template>
  <div class="rules-list-tab">
    <!-- Top Filter Controls Bar -->
    <div class="filter-controls-card">
      <!-- Search Input -->
      <div class="search-row">
        <KitInput
          v-model="searchQuery"
          icon="mdi:magnify"
          clearable
          :placeholder="t('plugins.grammar-rules.searchPlaceholder')"
          class="rules-search-input"
        />
      </div>

      <!-- Quick Level Pills Carousel -->
      <div v-if="levelOptions.length > 1" class="chips-row-wrapper">
        <div class="chips-row">
          <button
            v-for="lvl in levelOptions"
            :key="lvl.value"
            type="button"
            class="filter-chip"
            :class="{ 'is-active': selectedLevel === lvl.value }"
            @click="selectedLevel = lvl.value"
          >
            <span>{{ lvl.label }}</span>
            <span v-if="typeof lvl.count === 'number'" class="chip-count">
              {{ lvl.count }}
            </span>
          </button>
        </div>
      </div>

      <!-- Category Filter Pills -->
      <div v-if="categoryOptions.length > 1" class="chips-row-wrapper categories">
        <div class="chips-row">
          <button
            v-for="cat in categoryOptions"
            :key="cat.value"
            type="button"
            class="filter-chip category-chip"
            :class="{ 'is-active': selectedCategory === cat.value }"
            @click="selectedCategory = cat.value"
          >
            <span v-if="cat.color && cat.value !== 'all'" class="cat-dot" :style="{ backgroundColor: cat.color }" />
            <span>{{ cat.label }}</span>
            <span v-if="typeof cat.count === 'number' && cat.value !== 'all'" class="chip-count">
              {{ cat.count }}
            </span>
          </button>
        </div>
      </div>

      <!-- Status / Summary Bar -->
      <div class="filter-status-bar">
        <span class="results-counter">
          {{ t('plugins.grammar-rules.showingRulesCount', { count: filteredRules.length, total: totalRulesCount ?? filteredRules.length }) }}
        </span>

        <button
          v-if="isAnyFilterActive"
          type="button"
          class="reset-filters-link"
          @click="onResetFilters"
        >
          <Icon icon="mdi:close" />
          <span>{{ t('plugins.grammar-rules.clearFilters') }}</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <Icon icon="mdi:loading" class="spin-icon" />
      <p>{{ t('plugins.grammar-rules.loadingRules') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredRules.length === 0" class="empty-state">
      <div class="empty-icon-wrap">
        <Icon icon="mdi:book-open-blank-variant" class="empty-icon" />
      </div>
      <p class="empty-text">
        {{ t('plugins.grammar-rules.rulesNotFound') }}
      </p>
      <KitBtn
        v-if="isAnyFilterActive"
        variant="tonal"
        color="accent"
        size="sm"
        icon="mdi:refresh"
        @click="onResetFilters"
      >
        {{ t('plugins.grammar-rules.clearFilters') }}
      </KitBtn>
    </div>

    <!-- Rules Grid -->
    <div v-else class="rules-grid">
      <RuleCard
        v-for="rule in filteredRules"
        :key="rule.id"
        :rule="rule"
        :mastery="getRuleMastery?.(rule.id)"
        @generate-test="(tests) => emit('addTests', tests)"
        @learn-more="(r) => openRuleDetails(r)"
        @practice-rule="onPracticeRule"
      />
    </div>

    <!-- Rule Deep Dive Modal -->
    <RuleDetailsModal
      v-model:visible="isModalOpen"
      :rule="selectedRule"
      :explanation="explanation"
      :loading="isExplanationLoading"
      :error="explanationError"
      @regenerate="regenerateExplanation"
      @practice="onPracticeRule"
    />
  </div>
</template>

<style lang="scss" scoped>
.rules-list-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.filter-controls-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 16px;
}

.search-row {
  width: 100%;

  .rules-search-input {
    width: 100%;
  }
}

.chips-row-wrapper {
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
}

.chips-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: min-content;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 99px;
  border: 1px solid var(--border-primary-color);
  background-color: var(--bg-primary-color);
  color: var(--fg-secondary-color);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    color: var(--fg-primary-color);
    border-color: var(--border-secondary-color);
    background-color: var(--bg-hover-color);
  }

  &.is-active {
    background-color: var(--fg-accent-color);
    border-color: var(--fg-accent-color);
    color: #fff;

    .chip-count {
      background-color: rgba(255, 255, 255, 0.25);
      color: #fff;
    }
  }

  .cat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chip-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    height: 16px;
    min-width: 16px;
    border-radius: 99px;
    font-size: 0.72rem;
    font-weight: 700;
    background-color: var(--bg-hover-color);
    color: var(--fg-secondary-color);
  }
}

.filter-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.85rem;
  padding-top: 4px;

  .results-counter {
    color: var(--fg-secondary-color);
    font-weight: 500;
  }

  .reset-filters-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: none;
    color: var(--fg-accent-color);
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 6px;

    &:hover {
      text-decoration: underline;
    }
  }
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 56px 24px;
  text-align: center;
  color: var(--fg-secondary-color);
  gap: 14px;
  background-color: var(--bg-secondary-color);
  border: 1px dashed var(--border-secondary-color);
  border-radius: 16px;

  .spin-icon {
    font-size: 2.2rem;
    animation: spin 1s linear infinite;
  }

  .empty-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background-color: var(--bg-hover-color);
    display: flex;
    align-items: center;
    justify-content: center;

    .empty-icon {
      font-size: 1.8rem;
      color: var(--fg-secondary-color);
    }
  }

  .empty-text {
    margin: 0;
    max-width: 360px;
    font-size: 0.95rem;
  }
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;

  @include media-down(sm) {
    grid-template-columns: 1fr;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
