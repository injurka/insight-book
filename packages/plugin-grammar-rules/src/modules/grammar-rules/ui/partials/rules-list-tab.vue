<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitInput, KitSelect } from '~/02.kit'
import type { Rule, RuleTest } from '../../../../shared/types'
import RuleCard from './rule-card.vue'

interface Props {
  filteredRules: Rule[]
  categoryOptions: Array<{ label: string, value: string }>
  levelOptions: Array<{ label: string, value: string }>
  loading?: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  (e: 'addTests', tests: RuleTest[]): void
}>()

const searchQuery = defineModel<string>('searchQuery', { required: true })
const selectedCategory = defineModel<string>('selectedCategory', { required: true })
const selectedLevel = defineModel<string>('selectedLevel', { required: true })

const { t } = useI18n()
const showMobileFilters = ref(false)

const activeFilterCount = computed(() => {
  let count = 0
  if (selectedCategory.value && selectedCategory.value !== 'all')
    count++
  if (selectedLevel.value && selectedLevel.value !== 'all')
    count++
  return count
})
</script>

<template>
  <div class="rules-tab-content">
    <div class="filters-bar">
      <div class="search-row">
        <KitInput
          v-model="searchQuery"
          icon="mdi:magnify"
          clearable
          :placeholder="t('plugins.grammar-rules.searchPlaceholder')"
          class="search-input"
        />

        <KitBtn
          class="mobile-filter-toggle-btn"
          variant="outlined"
          :color="activeFilterCount > 0 ? 'accent' : 'secondary'"
          icon="mdi:filter-variant"
          :aria-label="t('plugins.grammar-rules.filtersToggle')"
          @click="showMobileFilters = !showMobileFilters"
        >
          <span v-if="activeFilterCount > 0" class="filter-count-chip">{{ activeFilterCount }}</span>
        </KitBtn>
      </div>

      <div class="filters-selects" :class="{ 'is-mobile-open': showMobileFilters }">
        <KitSelect
          v-model="selectedCategory"
          icon="mdi:tag-outline"
          :options="categoryOptions"
          class="category-select"
        />
        <KitSelect
          v-model="selectedLevel"
          icon="mdi:signal-cellular-3"
          :options="levelOptions"
          class="level-select"
        />
      </div>
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
      <RuleCard
        v-for="rule in filteredRules"
        :key="rule.id"
        :rule="rule"
        @generate-test="(tests) => emit('addTests', tests)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rules-tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 12px;
  padding: 4px;
}

.filters-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  width: 100%;

  .search-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .search-input {
    flex: 1;
  }

  .mobile-filter-toggle-btn {
    display: none;
  }

  .filters-selects {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .category-select, .level-select {
    width: 190px;
    flex-shrink: 0;
  }

  .filter-count-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: var(--fg-accent-color);
    color: var(--bg-primary-color);
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 99px;
    padding: 0 6px;
    height: 18px;
    min-width: 18px;
    margin-left: 4px;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;

    .mobile-filter-toggle-btn {
      display: inline-flex;
    }

    .filters-selects {
      display: none;
      flex-direction: column;
      width: 100%;
      gap: 10px;
      padding-top: 4px;

      &.is-mobile-open {
        display: flex;
      }
    }

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
