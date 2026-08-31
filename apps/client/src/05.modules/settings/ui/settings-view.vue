<script setup lang="ts">
import type { TabItem } from '~/02.kit/molecules/kit-tabs/ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '~/01.shared/composables/use-toast'
import { AppRoutePaths } from '~/01.shared/constants/routes'
import { useAuthStore } from '~/01.shared/store/auth.store'
import { useCacheStore } from '~/01.shared/store/cache.store'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitHoverRevealBg } from '~/02.kit/atoms/kit-hover-reveal-bg/ui'
import { KitTabs } from '~/02.kit/molecules/kit-tabs/ui'

import SettingsAccountPanel from './panels/settings-account-panel.vue'
import SettingsAiPanel from './panels/settings-ai-panel.vue'
import SettingsBooksCachePanel from './panels/settings-books-cache-panel.vue'
import SettingsInfoPanel from './panels/settings-info-panel.vue'
import SettingsInterfacePanel from './panels/settings-interface-panel.vue'
import SettingsPluginsPanel from './panels/settings-plugins-panel.vue'
import SettingsStoragePanel from './panels/settings-storage-panel.vue'

const cacheStore = useCacheStore()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const toast = useToast()
const { t } = useI18n()

const currentTab = ref((!authStore.isSingleMode && authStore.user) ? 'account' : 'interface')

const tabs = computed<TabItem<string>[]>(() => {
  const items: TabItem<string>[] = []

  if (!authStore.isSingleMode && authStore.user) {
    items.push({ id: 'account', label: t('settings.accountTitle', 'Аккаунт'), icon: 'mdi:account-outline' })
  }

  items.push(
    { id: 'interface', label: t('settings.interfaceTitle'), icon: 'mdi:palette-outline' },
    { id: 'ai', label: t('settings.aiTitle'), icon: 'mdi:robot-outline' },
    { id: 'plugins', label: t('settings.pluginsTitle'), icon: 'mdi:puzzle-outline' },
    { id: 'system', label: t('settings.systemTitle'), icon: 'mdi:database-outline' },
  )

  return items
})

onMounted(() => {
  cacheStore.loadStats()

  if (route.query.oauth_success) {
    const successKey = String(route.query.oauth_success)
    if (successKey === 'yandex_linked') {
      toast.success(t('settings.yandexLinkedSuccess', 'Аккаунт Яндекс успешно привязан!'))
    }
    else {
      toast.success(t('settings.accountLinkedSuccess', 'Аккаунт успешно привязан!'))
    }

    currentTab.value = 'account'
    authStore.checkAuth()
    router.replace({ query: {} })
  }
  else if (route.query.oauth_error) {
    toast.error(decodeURIComponent(String(route.query.oauth_error)))
    currentTab.value = 'account'
    router.replace({ query: {} })
  }
})
</script>

<template>
  <div class="settings-page">
    <KitHoverRevealBg />

    <header class="page-header">
      <KitBtn
        icon="mdi:arrow-left"
        variant="text"
        size="md"
        @click="router.push(AppRoutePaths.Home)"
      />
      <div class="header-title">
        <h1>{{ t('settings.title') }}</h1>
        <p>{{ t('settings.subtitle') }}</p>
      </div>
    </header>

    <div class="content-wrapper">
      <KitTabs v-model="currentTab" :items="tabs" :cache="false">
        <template #account>
          <div class="tab-pane-content">
            <SettingsAccountPanel />
          </div>
        </template>
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
        <template #plugins>
          <div class="tab-pane-content">
            <SettingsPluginsPanel />
          </div>
        </template>
        <template #system>
          <div class="tab-pane-content storage-tab-content">
            <SettingsStoragePanel />
            <SettingsBooksCachePanel />
            <div style="height: 32px" />
            <SettingsInfoPanel />
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
  padding-top: calc(32px + var(--safe-area-top));
  width: 100%;
  height: 100%;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;

  @include media-down(md) {
    padding: 16px;
    padding-top: calc(16px + var(--safe-area-top));
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
