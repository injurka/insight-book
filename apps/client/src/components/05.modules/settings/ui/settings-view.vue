<script setup lang="ts">
import type { TabItem } from '~/components/01.kit/kit-tabs'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit'
import { KitTabs } from '~/components/01.kit/kit-tabs'
import { HoverRevealBg } from '~/components/02.shared/hover-reveal-bg'
import { AppRoutePaths } from '~/shared/constants/routes'
import { useCacheStore } from '~/shared/store/cache.store'

import SettingsAiPanel from './panels/settings-ai-panel.vue'
import SettingsBooksCachePanel from './panels/settings-books-cache-panel.vue'
import SettingsInterfacePanel from './panels/settings-interface-panel.vue'
import SettingsStoragePanel from './panels/settings-storage-panel.vue'

const cacheStore = useCacheStore()
const router = useRouter()
const { t } = useI18n()

onMounted(() => {
  cacheStore.loadStats()
})

const currentTab = ref('interface')

const tabs = computed<TabItem<string>[]>(() => [
  { id: 'interface', label: t('settings.interfaceTitle'), icon: 'mdi:palette-outline' },
  { id: 'ai', label: t('settings.aiTitle'), icon: 'mdi:robot-outline' },
  { id: 'storage', label: t('settings.storageTitle'), icon: 'mdi:database-outline' },
])
</script>

<template>
  <div class="settings-page">
    <HoverRevealBg />

    <header class="page-header">
      <KitBtn icon="mdi:arrow-left" variant="text" size="md" @click="router.push(AppRoutePaths.Home)" />
      <div class="header-title">
        <h1>{{ t('settings.title') }}</h1>
        <p>{{ t('settings.subtitle') }}</p>
      </div>
    </header>

    <div class="content-wrapper">
      <KitTabs v-model="currentTab" :items="tabs" :cache="false">
        <template #interface>
          <div class="tab-pane-content">
            <SettingsInterfacePanel />
          </div>
        </template>
        <template #ai>
          <div class="tab-pane-content">
            <SettingsAiPanel />
          </div>
        </template>
        <template #storage>
          <div class="tab-pane-content storage-tab-content">
            <SettingsStoragePanel />
            <SettingsBooksCachePanel />
          </div>
        </template>
      </KitTabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-page {
  position: relative;
  z-index: 1;
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
  width: 100%;
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;

  @include media-down(md) {
    padding: 16px;
  }
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-secondary-color);

  .header-title {
    h1 {
      margin: 0 0 4px;
      font-size: 1.8rem;
      color: var(--fg-primary-color);
      letter-spacing: -0.5px;
    }
    p {
      margin: 0;
      color: var(--fg-secondary-color);
      font-size: 0.95rem;
    }
  }
}

.content-wrapper {
  display: flex;
  flex-direction: column;
}

.tab-pane-content {
  display: flex;
  flex-direction: column;
  animation: fade-in 0.3s ease-out;

  :deep(.section-title) {
    display: none; // Hide primary section titles as tabs replace them
  }
}

.storage-tab-content {
  :deep(.section-title) {
    // Only show secondary section titles in storage tab
    &:not(:first-child) {
      display: block;
      margin-top: 16px;
      margin-bottom: 16px;
      font-size: 1.2rem;
      color: var(--fg-secondary-color);
    }
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
