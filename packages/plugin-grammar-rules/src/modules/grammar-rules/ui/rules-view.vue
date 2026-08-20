<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitSelect, KitTabs } from '~/02.kit'
import type { SupportedLanguage } from '../../../shared/types'
import { useGrammarCatalog } from '../composables/use-grammar-catalog'
import { useRulesFilter } from '../composables/use-rules-filter'

import RulesListTab from './partials/rules-list-tab.vue'
import RulesTestTab from './partials/rules-test-tab.vue'

const { t } = useI18n()
const router = useRouter()

const {
  currentLanguage,
  availableLanguages,
  currentConfig,
  rules,
  tests,
  isLoading,
  setLanguage,
  addCustomTests,
} = useGrammarCatalog()

const activeTab = ref<'rules' | 'test'>('rules')

const {
  searchQuery,
  selectedCategory,
  selectedLevel,
  categoryOptions,
  levelOptions,
  filteredRules,
} = useRulesFilter(rules, currentConfig)

const tabItems = computed(() => [
  {
    id: 'rules',
    label: t('plugins.grammar-rules.tabStudy'),
    icon: 'mdi:book-open-page-variant-outline',
  },
  {
    id: 'test',
    label: t('plugins.grammar-rules.tabTest'),
    icon: 'mdi:clipboard-check-outline',
  },
])

const languageSelectOptions = computed(() => {
  return availableLanguages.value.map(lang => ({
    label: lang.name,
    value: lang.code,
    icon: lang.code === 'zh' ? 'mdi:ideogram-cjk-variant' : 'mdi:alphabetical-variant',
  }))
})

const onLanguageChange = (val: unknown) => {
  if (typeof val === 'string') {
    setLanguage(val as SupportedLanguage)
  }
}

const onStartRuleTest = (generatedTests: typeof tests.value) => {
  addCustomTests(generatedTests)
  activeTab.value = 'test'
}
</script>

<template>
  <div class="rules-scroll-container">
    <div class="rules-page">
      <header class="rules-header">
        <div class="header-nav">
          <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
          <div class="header-info">
            <h1 class="page-title">
              {{ t('plugins.grammar-rules.pageTitle') }}
            </h1>
            <p class="page-subtitle">
              {{ t('plugins.grammar-rules.pageSubtitle') }}
            </p>
          </div>
        </div>

        <div class="header-actions">
          <KitSelect
            :model-value="currentLanguage"
            :options="languageSelectOptions"
            icon="mdi:translate"
            size="sm"
            class="header-language-select"
            @update:model-value="onLanguageChange"
          />
        </div>
      </header>

      <div class="rules-tabs-container">
        <KitTabs v-model="activeTab" :items="tabItems">
          <template #rules>
            <RulesListTab
              v-model:searchQuery="searchQuery"
              v-model:selectedCategory="selectedCategory"
              v-model:selectedLevel="selectedLevel"
              :filtered-rules="filteredRules"
              :category-options="categoryOptions"
              :level-options="levelOptions"
              :loading="isLoading"
              @add-tests="onStartRuleTest"
            />
          </template>
          <template #test>
            <RulesTestTab
              :filtered-rules="filteredRules"
              :tests="tests"
              :current-lang="currentLanguage"
            />
          </template>
        </KitTabs>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rules-scroll-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rules-page {
  background-color: var(--bg-primary-color);
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-language-select {
  width: auto;
  min-width: 170px;

  :deep(.kit-select-trigger) {
    height: 34px;
    border-radius: 20px;
    padding: 0 12px 0 10px;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-primary-color);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

    &:hover {
      border-color: var(--fg-accent-color);
      background-color: var(--bg-hover-color);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }

    .selected-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }

    .select-prepend-icon {
      color: var(--fg-accent-color);
      font-size: 1.15rem;
    }

    .trigger-icon {
      color: var(--fg-secondary-color);
      font-size: 1.1rem;
    }
  }

  @media (max-width: 600px) {
    min-width: 140px;
  }
}

.header-info {
  .page-title {
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--fg-primary-color);
    margin: 0 0 4px 0;
  }

  .page-subtitle {
    font-size: 1rem;
    color: var(--fg-secondary-color);
    margin: 0;
  }
}

.rules-tabs-container {
  border-radius: 16px;
}
</style>
