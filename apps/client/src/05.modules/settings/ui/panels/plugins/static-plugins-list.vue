<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { pluginManager } from '~/00.plugins/plugin-manager'
import { useGlobalSettingsStore } from '~/01.shared/store/settings.store'
import { KitCheckbox } from '~/02.kit'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const router = useRouter()

const availableStaticPlugins = computed(() => [
  {
    id: 'grammar-rules',
    name: t('plugins.grammar-rules.name', 'Грамматические правила'),
    description: t('plugins.grammar-rules.description', 'Изучение и проверка правил грамматики'),
    icon: 'mdi:school-outline',
  },
  {
    id: 'scroll-study',
    name: t('plugins.scroll-study.name', 'Изучение свитков'),
    description: t('plugins.scroll-study.description', 'Магическое исследование свитков и иероглифов на шестиугольной доске'),
    icon: 'mdi:scroll-text-outline',
  },
])

async function toggleStaticPlugin(pluginId: string, enabled: boolean) {
  if (enabled) {
    if (!settingsStore.enabledPlugins.includes(pluginId)) {
      settingsStore.enabledPlugins.push(pluginId)

      if (pluginId === 'grammar-rules') {
        try {
          const { default: grammarRulesPlugin } = await import('@injurka/insight-book-plugin-grammar-rules')
          await pluginManager.install(null, router, [grammarRulesPlugin])
        }
        catch (e) {
          console.error('Failed to load plugin', e)
        }
      }
      else if (pluginId === 'scroll-study') {
        try {
          const { default: scrollStudyPlugin } = await import('@injurka/insight-book-plugin-scroll-study')
          await pluginManager.install(null, router, [scrollStudyPlugin])
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
  <div class="section-group">
    <h3 class="group-title">
      {{ t('settings.staticPlugins', 'Встроенные модули') }}
    </h3>
    <div class="plugins-list">
      <div v-for="plugin in availableStaticPlugins" :key="plugin.id" class="plugin-card">
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
            @update:model-value="toggleStaticPlugin(plugin.id, $event)"
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
