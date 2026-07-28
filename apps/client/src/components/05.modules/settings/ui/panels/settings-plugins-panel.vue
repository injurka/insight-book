<script setup lang="ts">
import type { UserPluginRecord } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitCheckbox, KitDialog, KitInput } from '~/components/01.kit'
import { useRepos } from '~/shared/plugins/di'
import { pluginManager } from '~/shared/plugins/plugin-manager'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useToastStore } from '~/shared/store/toast.store'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const router = useRouter()
const repos = useRepos()
const toast = useToastStore()

const remotePlugins = ref<UserPluginRecord[]>([])
const isLoading = ref(false)

const isInstallModalOpen = ref(false)
const inputManifestUrl = ref('')
const isInstalling = ref(false)

const availableStaticPlugins = computed(() => [
  {
    id: 'grammar-rules',
    name: t('plugins.grammar-rules.name', 'Grammar Rules'),
    description: t('plugins.grammar-rules.description', 'Learn and test language grammar rules.'),
    icon: 'mdi:school-outline',
  },
])

async function fetchRemotePlugins() {
  isLoading.value = true
  try {
    remotePlugins.value = await repos.plugin.getMyPlugins()
  }
  catch (err) {
    console.error('Failed to fetch remote plugins', err)
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchRemotePlugins()
})

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
    }
  }
  else {
    settingsStore.enabledPlugins = settingsStore.enabledPlugins.filter(id => id !== pluginId)
    await pluginManager.uninstall(pluginId, router)
  }
}

function openInstallModal() {
  inputManifestUrl.value = ''
  isInstallModalOpen.value = true
}

async function confirmInstallRemotePlugin() {
  const url = inputManifestUrl.value.trim()
  if (!url) {
    toast.error(t('settings.plugins.emptyUrl', 'Укажите URL манифеста плагина'))
    return
  }

  isInstalling.value = true
  try {
    const loadedPlugin = await pluginManager.loadRemotePlugin(url, router)
    if (!loadedPlugin) {
      toast.error(t('settings.plugins.installFailed', 'Не удалось загрузить плагин по указанному URL'))
      return
    }

    await repos.plugin.installPlugin({
      pluginId: loadedPlugin.id,
      manifestUrl: url,
      isEnabled: true,
    })

    toast.success(t('settings.plugins.installSuccess', { name: loadedPlugin.name }))
    isInstallModalOpen.value = false
    inputManifestUrl.value = ''
    await fetchRemotePlugins()
  }
  catch (err: unknown) {
    console.error('Failed to install plugin:', err)
    const msg = err instanceof Error ? err.message : 'Ошибка при установке плагина'
    toast.error(msg)
  }
  finally {
    isInstalling.value = false
  }
}

async function toggleRemotePlugin(record: UserPluginRecord, enabled: boolean) {
  try {
    await repos.plugin.updatePlugin(record.pluginId, { isEnabled: enabled })
    record.isEnabled = enabled

    if (enabled) {
      await pluginManager.loadRemotePlugin(record.manifestUrl, router)
      toast.success(t('settings.plugins.enabled', 'Плагин включен'))
    }
    else {
      await pluginManager.uninstall(record.pluginId, router)
      toast.info(t('settings.plugins.disabled', 'Плагин отключен'))
    }
  }
  catch (err) {
    console.error('Failed to toggle plugin state:', err)
    toast.error('Не удалось изменить состояние плагина')
  }
}

async function uninstallRemotePlugin(pluginId: string) {
  try {
    await repos.plugin.uninstallPlugin(pluginId)
    await pluginManager.uninstall(pluginId, router)
    toast.success(t('settings.plugins.uninstalled', 'Плагин удален'))
    await fetchRemotePlugins()
  }
  catch (err) {
    console.error('Failed to uninstall remote plugin:', err)
    toast.error('Не удалось удалить плагин')
  }
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
      <KitBtn
        color="primary"
        icon="mdi:plus"
        size="sm"
        :title="t('settings.addRemotePlugin')"
        :aria-label="t('settings.addRemotePlugin')"
        @click="openInstallModal"
      />
    </div>

    <!-- Встроенные статические плагины -->
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

    <!-- Динамические плагины, установленные пользователем -->
    <div class="section-group">
      <h3 class="group-title">
        {{ t('settings.dynamicPlugins', 'Установленные динамические плагины') }}
      </h3>

      <div v-if="remotePlugins.length === 0" class="empty-state">
        <Icon icon="mdi:puzzle-remove-outline" class="empty-icon" />
        <p>{{ t('settings.noDynamicPlugins', 'У вас пока нет установленных динамических плагинов') }}</p>
      </div>

      <div v-else class="plugins-list">
        <div v-for="record in remotePlugins" :key="record.pluginId" class="plugin-card">
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
              @update:model-value="toggleRemotePlugin(record, $event)"
            />
            <KitBtn
              variant="text"
              color="danger"
              icon="mdi:delete-outline"
              size="sm"
              @click="uninstallRemotePlugin(record.pluginId)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Модальное окно установки динамического плагина по URL -->
    <KitDialog
      v-model:visible="isInstallModalOpen"
      :title="t('settings.installPluginModalTitle', 'Установка динамического плагина')"
      :max-width="540"
    >
      <div class="install-dialog-content">
        <div class="warning-banner">
          <Icon icon="mdi:alert-decagram-outline" class="warning-icon" />
          <div>
            <strong>{{ t('settings.securityWarningTitle', 'Предупреждение по безопасности') }}</strong>
            <p>
              {{ t('settings.securityWarningText', 'Плагины сторонних разработчиков выполняют JavaScript-код в контексте вашей сессии. Устанавливайте плагины только из проверенных и надежных источников.') }}
            </p>
          </div>
        </div>

        <div class="field-group">
          <label>{{ t('settings.manifestUrlLabel', 'URL манифеста плагина (JSON):') }}</label>
          <KitInput
            v-model="inputManifestUrl"
            placeholder="https://example.com/my-plugin/manifest.json"
          />
        </div>

        <div class="dialog-actions">
          <KitBtn variant="tonal" size="sm" @click="isInstallModalOpen = false">
            {{ t('common.cancel', 'Отмена') }}
          </KitBtn>
          <KitBtn
            color="primary"
            size="sm"
            :loading="isInstalling"
            @click="confirmInstallRemotePlugin"
          >
            {{ t('settings.installConfirm', 'Подтвердить и установить') }}
          </KitBtn>
        </div>
      </div>
    </KitDialog>
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

.install-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 12px;
}

.warning-banner {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  background: rgba(var(--bg-accent-color-rgb, 239, 68, 68), 0.1);
  border: 1px solid var(--border-danger-color, #ef4444);
  border-radius: 10px;
  color: var(--fg-primary-color);
  font-size: 0.85rem;
  line-height: 1.4;

  .warning-icon {
    font-size: 1.8rem;
    color: var(--fg-danger-color, #ef4444);
    flex-shrink: 0;
  }

  strong {
    display: block;
    margin-bottom: 4px;
    color: var(--fg-danger-color, #ef4444);
  }

  p {
    margin: 0;
  }
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--fg-primary-color);
  }
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}
</style>
