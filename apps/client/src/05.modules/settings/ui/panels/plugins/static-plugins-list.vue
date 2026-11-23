<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { builtInPlugins, isBuiltInPluginEnabled } from '~/00.plugins/built-in-plugins'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitCheckbox } from '~/02.kit/atoms/kit-checkbox/ui'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
</script>

<template>
  <div class="section-group">
    <h3 class="group-title">
      {{ t('settings.staticPlugins', 'Встроенные модули') }}
    </h3>
    <div class="plugins-list">
      <div v-for="plugin in builtInPlugins" :key="plugin.id" class="plugin-card">
        <div class="plugin-icon">
          <Icon :icon="plugin.icon" />
        </div>
        <div class="plugin-info">
          <h3>{{ t(`plugins.${plugin.id}.name`) }}</h3>
          <p>{{ t(`plugins.${plugin.id}.description`) }}</p>
        </div>
        <div class="plugin-action">
          <KitCheckbox
            :model-value="isBuiltInPluginEnabled(plugin, settingsStore)"
            @update:model-value="settingsStore.builtInPluginOverrides[plugin.id] = $event"
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
</style>
