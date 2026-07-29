<script setup lang="ts">
import type { CatalogPluginRecord } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog } from '~/components/01.kit'
import { usePluginsStore } from '../../../store/plugins.store'

const visible = defineModel<boolean>('visible', { required: true })

const { t } = useI18n()
const pluginsStore = usePluginsStore()

const installingCatalogId = ref<number | null>(null)

watch(visible, (isOpen) => {
  if (isOpen)
    pluginsStore.loadCatalog()
})

async function installCatalogPlugin(record: CatalogPluginRecord) {
  installingCatalogId.value = record.id
  await pluginsStore.installPluginByUrl(record.manifestUrl)
  installingCatalogId.value = null
}
</script>

<template>
  <KitDialog
    v-model:visible="visible"
    :title="t('settings.communityPluginsTitle', 'Каталог плагинов сообщества')"
    :max-width="640"
  >
    <div class="install-dialog-content">
      <div v-if="pluginsStore.isCatalogLoading" class="empty-state">
        <Icon icon="mdi:loading" class="empty-icon rotating" />
      </div>

      <div v-else-if="pluginsStore.catalogPlugins.length === 0" class="empty-state">
        <Icon icon="mdi:puzzle-remove-outline" class="empty-icon" />
        <p>{{ t('settings.noCommunityPlugins', 'В каталоге пока нет одобренных плагинов') }}</p>
      </div>

      <div v-else class="plugins-list">
        <div v-for="record in pluginsStore.catalogPlugins" :key="record.id" class="plugin-card">
          <div class="plugin-icon">
            <Icon :icon="record.icon || 'mdi:puzzle-outline'" />
          </div>
          <div class="plugin-info">
            <h3>
              {{ record.name }}
              <span class="version-badge">v{{ record.version }}</span>
            </h3>
            <p v-if="record.description">
              {{ record.description }}
            </p>
            <p v-if="record.author" class="plugin-author">
              {{ record.author }}
            </p>
          </div>
          <div class="plugin-action">
            <KitBtn
              v-if="pluginsStore.isCatalogPluginInstalled(record)"
              variant="tonal"
              size="sm"
              disabled
            >
              {{ t('settings.installedFromCatalog', 'Установлен') }}
            </KitBtn>
            <KitBtn
              v-else
              color="primary"
              size="sm"
              :loading="installingCatalogId === record.id"
              @click="installCatalogPlugin(record)"
            >
              {{ t('settings.installFromCatalog', 'Установить') }}
            </KitBtn>
          </div>
        </div>
      </div>
    </div>
  </KitDialog>
</template>

<style lang="scss" scoped>
.install-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px;
  background: var(--bg-secondary-color);
  border-radius: 12px;
  border: 1px dashed var(--border-secondary-color);
  color: var(--fg-secondary-color);
  text-align: center;

  .empty-icon {
    font-size: 2.5rem;
    opacity: 0.6;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
  }
}

.plugins-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plugin-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background: var(--bg-secondary-color);
  border: 1px solid var(--border-secondary-color);
  transition:
    border-color 0.2s,
    transform 0.2s;

  &:hover {
    border-color: var(--border-primary-color);
  }

  .plugin-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: var(--bg-tertiary-color);
    color: var(--fg-accent-color);
    font-size: 1.5rem;
  }

  .plugin-info {
    flex: 1;
    min-width: 0;

    h3 {
      margin: 0 0 4px;
      font-size: 1.1rem;
      color: var(--fg-primary-color);
      font-weight: 600;
    }

    p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--fg-secondary-color);
      line-height: 1.4;
    }
  }

  .plugin-action {
    display: flex;
    align-items: center;
  }
}

.version-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--bg-tertiary-color);
  color: var(--fg-secondary-color);
  font-size: 0.75rem;
  font-weight: 500;
  vertical-align: middle;
}

.plugin-author {
  font-size: 0.8rem;
  color: var(--fg-muted-color);
}

.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
