<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitCheckbox } from '~/components/01.kit'
import { pluginManager } from '~/shared/plugins/plugin-manager'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const router = useRouter()

const availablePlugins = computed(() => [
  {
    id: 'grammar-rules',
    name: t('plugins.grammar-rules.name', 'Grammar Rules'),
    description: t('plugins.grammar-rules.description', 'Learn and test language grammar rules.'),
    icon: 'mdi:school-outline',
  },
])

async function togglePlugin(pluginId: string, enabled: boolean) {
  if (enabled) {
    if (!settingsStore.enabledPlugins.includes(pluginId)) {
      settingsStore.enabledPlugins.push(pluginId)

      if (pluginId === 'grammar-rules') {
        try {
          const { default: grammarRulesPlugin } = await import('@injurka/insight-book-plugin-grammar-rules')
          await pluginManager.install({} as any, router, [grammarRulesPlugin])
        }
        catch (e) {
          console.error('Failed to load plugin', e)
        }
      }
    }
  }
  else {
    settingsStore.enabledPlugins = settingsStore.enabledPlugins.filter(id => id !== pluginId)
    await pluginManager.uninstall(pluginId, router)
  }
}
</script>

<template>
  <div class="settings-plugins-panel">
    <div class="panel-header">
      <h2 class="section-title">
        {{ t('settings.pluginsTitle', 'Плагины') }}
      </h2>
      <p class="section-subtitle">
        {{ t('settings.pluginsSubtitle', 'Управление дополнительными модулями и расширениями') }}
      </p>
    </div>

    <div class="plugins-list">
      <div v-for="plugin in availablePlugins" :key="plugin.id" class="plugin-card">
        <div class="plugin-icon">
          <Icon :icon="plugin.icon" />
        </div>
        <div class="plugin-info">
          <h3>{{ plugin.name }}</h3>
          <p>{{ plugin.description }}</p>
        </div>
        <div class="plugin-action">
          <KitCheckbox
            :model-value="settingsStore.enabledPlugins.includes(plugin.id)"
            @update:model-value="togglePlugin(plugin.id, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-plugins-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel-header {
  margin-bottom: 8px;
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
</style>
