<script setup lang="ts">
import type { CatalogPluginRecord } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/02.kit'
import { usePluginsStore } from '../../../store/plugins.store'

const { t } = useI18n()
const pluginsStore = usePluginsStore()

function statusLabel(status: CatalogPluginRecord['status']) {
  const labels: Record<CatalogPluginRecord['status'], string> = {
    pending: t('settings.pluginStatusPending', 'На рассмотрении'),
    approved: t('settings.pluginStatusApproved', 'Одобрен'),
    rejected: t('settings.pluginStatusRejected', 'Отклонён'),
  }
  return labels[status]
}
</script>

<template>
  <div v-if="pluginsStore.myUploadedPlugins.length > 0" class="section-group">
    <h3 class="group-title">
      {{ t('settings.myUploadedPlugins', 'Мои загруженные плагины') }}
    </h3>
    <div class="plugins-list">
      <div v-for="record in pluginsStore.myUploadedPlugins" :key="record.id" class="plugin-card">
        <div class="plugin-icon">
          <Icon :icon="record.icon || 'mdi:puzzle-outline'" />
        </div>
        <div class="plugin-info">
          <h3>
            {{ record.name }}
            <span class="version-badge">v{{ record.version }}</span>
            <span class="status-badge" :class="`status-${record.status}`">{{ statusLabel(record.status) }}</span>
          </h3>
          <p v-if="record.description">
            {{ record.description }}
          </p>
        </div>
        <div class="plugin-action">
          <KitBtn
            variant="text"
            color="error"
            icon="mdi:delete-outline"
            size="sm"
            :title="t('settings.deleteCatalogPlugin', 'Удалить')"
            @click="pluginsStore.deleteCatalogPlugin(record.id)"
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

.status-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  vertical-align: middle;

  &.status-pending {
    background: rgba(234, 179, 8, 0.15);
    color: #eab308;
  }

  &.status-approved {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
  }

  &.status-rejected {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }
}
</style>
