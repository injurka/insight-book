<script setup lang="ts">
import type { CatalogPluginRecord } from '~/01.shared/types/models'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/atoms/kit-btn/ui'
import { KitTabs } from '~/02.kit/molecules/kit-tabs/ui'
import { usePluginsStore } from '../../store/plugins.store'
import ModerationPluginsList from './plugins/moderation-plugins-list.vue'
import PluginCatalogModal from './plugins/plugin-catalog-modal.vue'
import PluginInstallUrlModal from './plugins/plugin-install-url-modal.vue'
import PluginUploadModal from './plugins/plugin-upload-modal.vue'
import RemotePluginsList from './plugins/remote-plugins-list.vue'
import StaticPluginsList from './plugins/static-plugins-list.vue'
import UploadedPluginsList from './plugins/uploaded-plugins-list.vue'

const { t } = useI18n()
const pluginsStore = usePluginsStore()

const isInstallModalOpen = ref(false)
const isCatalogModalOpen = ref(false)
const isUploadModalOpen = ref(false)
const selectedPlugin = ref<CatalogPluginRecord | null>(null)
const currentTab = ref('installed')
const tabs = computed(() => [
  { id: 'installed', label: t('settings.installedPluginsTab'), icon: 'mdi:puzzle-outline' },
  { id: 'published', label: t('settings.publishedPluginsTab'), icon: 'mdi:upload-outline' },
  ...(pluginsStore.isAdmin ? [{ id: 'moderation', label: t('settings.moderationTitle'), icon: 'mdi:shield-check-outline' }] : []),
])

function openUpload(plugin: CatalogPluginRecord | null = null) {
  selectedPlugin.value = plugin
  isUploadModalOpen.value = true
}
</script>

<template>
  <div class="settings-plugins-panel">
    <div class="panel-header">
      <div>
        <h2 class="section-title">
          {{ t('settings.pluginsTitle', 'Плагины') }}
        </h2>
        <p class="section-subtitle">
          {{ t('settings.pluginsSubtitle', 'Управление дополнительными модулями и динамическими плагинами по URL') }}
        </p>
      </div>
      <div class="panel-actions">
        <KitBtn
          variant="tonal"
          icon="mdi:account-group-outline"
          size="sm"
          @click="isCatalogModalOpen = true"
        >
          {{ t('settings.communityPlugins', 'Плагины сообщества') }}
        </KitBtn>
        <KitBtn
          variant="tonal"
          icon="mdi:upload-outline"
          size="sm"
          @click="openUpload()"
        >
          {{ t('settings.uploadPlugin', 'Загрузить плагин') }}
        </KitBtn>
        <KitBtn
          color="primary"
          class="add-remote-plugin-btn"
          icon="mdi:plus"
          size="sm"
          :title="t('settings.addRemotePlugin')"
          :aria-label="t('settings.addRemotePlugin')"
          @click="isInstallModalOpen = true"
        >
          {{ t('settings.addRemotePlugin') }}
        </KitBtn>
      </div>
    </div>

    <KitTabs v-model="currentTab" :items="tabs" :cache="false">
      <template #installed>
        <div class="plugin-sections">
          <StaticPluginsList />
          <RemotePluginsList />
        </div>
      </template>
      <template #published>
        <div class="plugin-sections">
          <UploadedPluginsList @update="openUpload" />
        </div>
      </template>
      <template #moderation>
        <div v-if="pluginsStore.isAdmin" class="plugin-sections">
          <ModerationPluginsList />
        </div>
      </template>
    </KitTabs>

    <PluginInstallUrlModal v-model:visible="isInstallModalOpen" />
    <PluginCatalogModal v-model:visible="isCatalogModalOpen" />
    <PluginUploadModal v-model:visible="isUploadModalOpen" :plugin="selectedPlugin" />
  </div>
</template>

<style lang="scss" scoped>
.settings-plugins-panel {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.plugin-sections {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-top: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;

  .section-title {
    font-size: 1.4rem;
    color: var(--fg-primary-color);
    margin: 0 0 4px;
  }
  .section-subtitle {
    color: var(--fg-secondary-color);
    font-size: 0.95rem;
    margin: 0;
  }
}

.panel-actions {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 12px;
  flex-wrap: wrap;
}

@include media-down(sm) {
  .panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  .panel-actions {
    width: 100%;

    :deep(.kit-btn) {
      flex: 1 1 auto;
      justify-content: center;
    }
  }
}
</style>
