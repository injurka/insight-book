<script setup lang="ts">
import type { Rule, SupportedLanguage } from '../../../shared/types'
import { computed, ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitSelect, KitTabs } from '~/02.kit'
import { useGrammarCatalog } from '../composables/use-grammar-catalog'
import { useGrammarSrs } from '../composables/use-grammar-srs'
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

const {
  searchQuery,
  selectedCategory,
  selectedLevel,
  categoryOptions,
  levelOptions,
  filteredRules,
} = useRulesFilter(rules, currentConfig)

const currentLangRef = toRef(currentLanguage)
const { getRuleSrs, rulesDueForReview } = useGrammarSrs(rules, currentLangRef)

const activeTab = ref<'rules' | 'test'>('rules')
const targetRuleForTest = ref<Rule | null>(null)

const tabItems = computed(() => [
  {
    id: 'rules',
    label: `${t('plugins.grammar-rules.tabStudy')} (${rules.value.length})`,
    icon: 'mdi:book-open-page-variant-outline',
  },
  {
    id: 'test',
    label: rulesDueForReview.value.length > 0
      ? `${t('plugins.grammar-rules.tabTest')} • ${rulesDueForReview.value.length}`
      : t('plugins.grammar-rules.tabTest'),
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

function onLanguageChange(val: unknown) {
  if (typeof val === 'string') {
    setLanguage(val as SupportedLanguage)
    targetRuleForTest.value = null
  }
}

function onStartRuleTest(generatedTests: typeof tests.value) {
  addCustomTests(generatedTests)
  activeTab.value = 'test'
}

function onPracticeRule(rule: Rule) {
  targetRuleForTest.value = rule
  activeTab.value = 'test'
}

function onClearTargetRule() {
  targetRuleForTest.value = null
}
</script>

<template>
  <div class="rules-page">
    <!-- Clean, Accessible Header -->
    <header class="rules-header">
      <div class="header-nav">
        <KitBtn
          icon="mdi:arrow-left"
          variant="text"
          size="md"
          class="back-nav-btn"
          @click="router.back()"
        />
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
        <!-- Language Switcher -->
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

    <!-- Segmented Navigation: Study vs Practice -->
    <div class="rules-tabs-container">
      <KitTabs v-model="activeTab" :items="tabItems">
        <template #rules>
          <RulesListTab
            v-model:search-query="searchQuery"
            v-model:selected-category="selectedCategory"
            v-model:selected-level="selectedLevel"
            :filtered-rules="filteredRules"
            :category-options="categoryOptions"
            :level-options="levelOptions"
            :total-rules-count="rules.length"
            :get-rule-mastery="(id) => getRuleSrs(id).mastery"
            :loading="isLoading"
            @add-tests="onStartRuleTest"
            @practice-rule="onPracticeRule"
          />
        </template>
        <template #test>
          <RulesTestTab
            :filtered-rules="filteredRules"
            :tests="tests"
            :current-lang="currentLanguage"
            :target-rule="targetRuleForTest"
            @clear-target-rule="onClearTargetRule"
            @back-to-rules="activeTab = 'rules'"
          />
        </template>
      </KitTabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rules-page {
  background-color: var(--bg-primary-color);
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-sizing: border-box;

  /* Safe Area insets for Tauri APK (Android / iOS / notch) */
  padding-top: calc(16px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
  padding-bottom: calc(36px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));

  @include media-down(md) {
    gap: 16px;
    padding-top: calc(12px + var(--safe-area-top, env(safe-area-inset-top, 0px)));
    padding-bottom: calc(24px + var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)));
    padding-left: max(12px, env(safe-area-inset-left, 0px));
    padding-right: max(12px, env(safe-area-inset-right, 0px));
  }
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding-bottom: 4px;

  @include media-down(sm) {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
}

.header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;

  .back-nav-btn {
    flex-shrink: 0;
  }
}

.header-info {
  min-width: 0;

  .page-title {
    font-size: 1.85rem;
    font-weight: 800;
    line-height: 1.2;
    color: var(--fg-primary-color);
    margin: 0 0 2px 0;
    letter-spacing: -0.5px;

    @include media-down(sm) {
      font-size: 1.45rem;
    }
  }

  .page-subtitle {
    font-size: 0.92rem;
    color: var(--fg-secondary-color);
    margin: 0;
    line-height: 1.4;

    @include media-down(sm) {
      font-size: 0.85rem;
    }
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  @include media-down(sm) {
    justify-content: flex-end;
  }
}

.header-language-select {
  width: auto;
  min-width: 170px;

  :deep(.kit-select-trigger) {
    height: 38px;
    border-radius: 12px;
    padding: 0 12px 0 10px;
    background-color: var(--bg-secondary-color);
    border: 1px solid var(--border-primary-color);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: var(--fg-accent-color);
      background-color: var(--bg-hover-color);
    }

    .selected-label {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--fg-primary-color);
    }
  }

  @include media-down(sm) {
    width: 100%;
    min-width: unset;
  }
}

.rules-tabs-container {
  width: 100%;
}
</style>
