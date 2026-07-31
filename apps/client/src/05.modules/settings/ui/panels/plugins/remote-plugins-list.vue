<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitCheckbox } from '~/02.kit'
import { usePluginsStore } from '../../../store/plugins.store'

const { t } = useI18n()
const pluginsStore = usePluginsStore()
</script>

<template>
  <div class="section-group">
    <h3 class="group-title">
      {{ t('settings.dynamicPlugins', 'Установленные динамические плагины') }}
    </h3>

    <div v-if="pluginsStore.remotePlugins.length === 0" class="empty-state">
      <Icon icon="mdi:puzzle-remove-outline" class="empty-icon" />
      <p>{{ t('settings.noDynamicPlugins', 'У вас пока нет установленных динамических плагинов') }}</p>
    </div>

    <div v-else class="plugins-list">
      <div v-for="record in pluginsStore.remotePlugins" :key="record.pluginId" class="plugin-card">
        <div class="plugin-icon">
          <Icon icon="mdi:puzzle-outline" />
        </div>
        <div class="plugin-info">
          <h3>{{ record.pluginId }}</h3>
          <p class="manifest-url">
            {{ record.manifestUrl }}
          </p>
        </div>
        <div class="plugin-action gap-12">
          <KitCheckbox
            :model-value="record.isEnabled"
            @update:model-value="pluginsStore.toggleRemotePlugin(record, $event)"
          />
          <KitBtn
            variant="text"
            color="error"
            icon="mdi:delete-outline"
            size="sm"
            @click="pluginsStore.uninstallRemotePlugin(record.pluginId)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.section-group {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .group-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
    margin: 0;
  }
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

    .manifest-url {
      font-size: 0.8rem;
      font-family: monospace;
      color: var(--fg-muted-color);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .plugin-action {
    display: flex;
    align-items: center;

    &.gap-12 {
      gap: 12px;
    }
  }
}
</style>
