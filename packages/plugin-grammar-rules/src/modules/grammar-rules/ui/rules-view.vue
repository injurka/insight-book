<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitTabs } from '~/02.kit'
import hsk1Rules from '~plugin/shared/data/hsk1-rules.json'
import hsk2Rules from '~plugin/shared/data/hsk2-rules.json'
import hsk1Tests from '~plugin/shared/data/hsk1-tests.json'
import hsk2Tests from '~plugin/shared/data/hsk2-tests.json'
import type { Rule, RuleTest } from '~plugin/shared/types'
import { useRulesFilter } from '../composables/use-rules-filter'

import RulesListTab from './partials/rules-list-tab.vue'
import RulesTestTab from './partials/rules-test-tab.vue'

const { t } = useI18n()
const router = useRouter()

const rules = ref<Rule[]>([...hsk1Rules, ...hsk2Rules] as Rule[])
const tests = ref<RuleTest[]>([...hsk1Tests, ...hsk2Tests] as RuleTest[])
const activeTab = ref<'rules' | 'test'>('rules')
const loading = ref(false)

const { searchQuery, selectedCategory, selectedLevel, filteredRules } = useRulesFilter(rules)

const tabItems = computed(() => [
  { id: 'rules', label: t('plugins.grammar-rules.tabStudy') },
  { id: 'test', label: t('plugins.grammar-rules.tabTest') }
])
</script>

<template>
  <div class="rules-scroll-container">
    <div class="rules-page">
      <header class="rules-header">
        <div class="header-nav">
          <KitBtn icon="mdi:arrow-left" variant="text" @click="router.back()" />
          <div class="header-info">
            <h1 class="page-title">{{ t('plugins.grammar-rules.pageTitle') }}</h1>
            <p class="page-subtitle">{{ t('plugins.grammar-rules.pageSubtitle') }}</p>
          </div>
        </div>
      </header>

      <div class="rules-tabs-container">
        <KitTabs v-model="activeTab" :items="tabItems">
          <template #rules>
            <RulesListTab
              :filtered-rules="filteredRules"
              v-model:searchQuery="searchQuery"
              v-model:selectedCategory="selectedCategory"
              v-model:selectedLevel="selectedLevel"
              :loading="loading"
            />
          </template>
          <template #test>
            <RulesTestTab
              :filtered-rules="filteredRules"
              :tests="tests"
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

.header-nav{
  display: flex;
  align-items: center;
  gap: 12px;
}

.rules-page {
  background-color: var(--bg-primary-color);
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 0px;
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
    align-items: flex-start;
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
  padding: 12px;
}
</style>
