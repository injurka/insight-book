<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit/index.ts'
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
          @click="isUploadModalOpen = true"
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
        />
      </div>
    </div>

    <StaticPluginsList />
    <RemotePluginsList />
    <UploadedPluginsList />
    <ModerationPluginsList v-if="pluginsStore.isAdmin" />

    <PluginInstallUrlModal v-model:visible="isInstallModalOpen" />
    <PluginCatalogModal v-model:visible="isCatalogModalOpen" />
    <PluginUploadModal v-model:visible="isUploadModalOpen" />
  </div>
</template>

<style lang="scss" scoped>
.settings-plugins-panel {
  display: flex;
  flex-direction: column;
  gap: 28px;
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

  .add-remote-plugin-btn {
    margin-left: auto;
  }
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
