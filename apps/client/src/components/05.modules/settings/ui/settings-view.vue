<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn } from '~/components/01.kit'
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
</script>

<template>
  <div class="cache-manager-page">
    <HoverRevealBg />

    <header class="page-header">
      <KitBtn icon="mdi:arrow-left" variant="text" @click="router.push(AppRoutePaths.Home)" />
      <div class="header-title">
        <h1>{{ t('settings.title') }}</h1>
        <p>{{ t('settings.subtitle') }}</p>
      </div>
    </header>

    <div class="content">
      <SettingsInterfacePanel />
      <SettingsAiPanel />
      <SettingsStoragePanel />

      <SettingsBooksCachePanel />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cache-manager-page {
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
  margin-bottom: 32px;

  .header-title {
    h1 {
      margin: 0 0 4px;
      font-size: 1.8rem;
      color: var(--fg-primary-color);
    }
    p {
      margin: 0;
      color: var(--fg-secondary-color);
    }
  }
}

.content {
  display: flex;
  flex-direction: column;
}
</style>
