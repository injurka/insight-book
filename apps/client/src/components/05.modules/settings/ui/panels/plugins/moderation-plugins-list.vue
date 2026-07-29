<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { KitBtn } from '~/components/01.kit'
import { usePluginsStore } from '../../../store/plugins.store'

const { t } = useI18n()
const pluginsStore = usePluginsStore()
</script>

<template>
  <div class="section-group">
    <h3 class="group-title">
      {{ t('settings.moderationTitle', 'Модерация') }}
    </h3>

    <div v-if="pluginsStore.pendingPlugins.length === 0" class="empty-state">
      <Icon icon="mdi:shield-check-outline" class="empty-icon" />
      <p>{{ t('settings.noPendingPlugins', 'Нет плагинов на модерации') }}</p>
    </div>

    <div v-else class="plugins-list">
      <div v-for="record in pluginsStore.pendingPlugins" :key="record.id" class="plugin-card">
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
        <div class="plugin-action gap-12">
          <KitBtn
            color="primary"
            icon="mdi:check"
            size="sm"
            :title="t('settings.approvePlugin', 'Одобрить')"
            @click="pluginsStore.moderatePlugin(record, 'approved')"
          />
          <KitBtn
            variant="tonal"
            color="error"
            icon="mdi:close"
            size="sm"
            :title="t('settings.rejectPlugin', 'Отклонить')"
            @click="pluginsStore.moderatePlugin(record, 'rejected')"
          />
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

    &.gap-12 {
      gap: 12px;
    }
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
</style>
