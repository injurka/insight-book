<script setup lang="ts">
import type { CatalogPluginRecord, UserPluginRecord } from '~/shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { KitBtn, KitCheckbox, KitDialog, KitInput } from '~/components/01.kit'
import { useRepos } from '~/shared/plugins/di'
import { pluginManager } from '~/shared/plugins/plugin-manager'
import { useAuthStore } from '~/shared/store/auth.store'
import { useGlobalSettingsStore } from '~/shared/store/settings.store'
import { useToastStore } from '~/shared/store/toast.store'

const { t } = useI18n()
const settingsStore = useGlobalSettingsStore()
const authStore = useAuthStore()
const router = useRouter()
const repos = useRepos()
const toast = useToastStore()

const remotePlugins = ref<UserPluginRecord[]>([])
const isLoading = ref(false)

const isInstallModalOpen = ref(false)
const inputManifestUrl = ref('')
const isInstalling = ref(false)

const isAdmin = computed(() => authStore.user?.role === 'admin')

// Каталог плагинов сообщества
const isCatalogModalOpen = ref(false)
const catalogPlugins = ref<CatalogPluginRecord[]>([])
const isCatalogLoading = ref(false)
const installingCatalogId = ref<number | null>(null)

// Загрузка своего плагина
const isUploadModalOpen = ref(false)
const uploadFile = ref<File | null>(null)
const isUploading = ref(false)
const myUploadedPlugins = ref<CatalogPluginRecord[]>([])

// Модерация (админ)
const pendingPlugins = ref<CatalogPluginRecord[]>([])

const availableStaticPlugins = computed(() => [{
  id: 'grammar-rules',
  name: t('plugins.grammar-rules.name'),
  description: t('plugins.grammar-rules.description'),
  icon: 'mdi:school-outline',
}])

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

onMounted(() => {
  fetchRemotePlugins()
  fetchMyUploadedPlugins()
  if (isAdmin.value) {
    fetchPendingPlugins()
  }
})

async function openCatalogModal() {
  isCatalogModalOpen.value = true
  isCatalogLoading.value = true
  try {
    catalogPlugins.value = await repos.catalogPlugin.getApproved()
  }
  catch (err) {
    console.error('Failed to fetch catalog plugins', err)
  }
  finally {
    isCatalogLoading.value = false
  }
}

function isCatalogPluginInstalled(record: CatalogPluginRecord) {
  return remotePlugins.value.some(p => p.manifestUrl === record.manifestUrl)
}

async function installCatalogPlugin(record: CatalogPluginRecord) {
  installingCatalogId.value = record.id
  try {
    const loadedPlugin = await pluginManager.loadRemotePlugin(record.manifestUrl, router)
    if (!loadedPlugin) {
      toast.error(t('settings.plugins.installFailed', 'Не удалось загрузить плагин по указанному URL'))
      return
    }

    await repos.plugin.installPlugin({
      pluginId: loadedPlugin.id,
      manifestUrl: record.manifestUrl,
      isEnabled: true,
    })

    toast.success(t('settings.plugins.installSuccess', { name: loadedPlugin.name }))
    await fetchRemotePlugins()
  }
  catch (err: unknown) {
    console.error('Failed to install catalog plugin:', err)
    const msg = err instanceof Error ? err.message : 'Ошибка при установке плагина'
    toast.error(msg)
  }
  finally {
    installingCatalogId.value = null
  }
}

function openUploadModal() {
  uploadFile.value = null
  isUploadModalOpen.value = true
}

function onUploadFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  uploadFile.value = input.files?.[0] ?? null
}

async function confirmUploadPlugin() {
  if (!uploadFile.value) {
    toast.error(t('settings.uploadPluginNoFile', 'Выберите zip-файл плагина'))
    return
  }

  isUploading.value = true
  try {
    await repos.catalogPlugin.upload(uploadFile.value)
    toast.success(t('settings.uploadPluginSuccess', 'Плагин отправлен на рассмотрение'))
    isUploadModalOpen.value = false
    uploadFile.value = null
    await fetchMyUploadedPlugins()
  }
  catch (err: unknown) {
    console.error('Failed to upload plugin:', err)
    const msg = err instanceof Error ? err.message : t('settings.uploadPluginFailed', 'Не удалось загрузить плагин')
    toast.error(msg)
  }
  finally {
    isUploading.value = false
  }
}

async function fetchMyUploadedPlugins() {
  try {
    myUploadedPlugins.value = await repos.catalogPlugin.getMy()
  }
  catch (err) {
    console.error('Failed to fetch my uploaded plugins', err)
  }
}

async function fetchPendingPlugins() {
  try {
    pendingPlugins.value = await repos.catalogPlugin.getPending()
  }
  catch (err) {
    console.error('Failed to fetch pending plugins', err)
  }
}

function statusLabel(status: CatalogPluginRecord['status']) {
  const labels: Record<CatalogPluginRecord['status'], string> = {
    pending: t('settings.pluginStatusPending', 'На рассмотрении'),
    approved: t('settings.pluginStatusApproved', 'Одобрен'),
    rejected: t('settings.pluginStatusRejected', 'Отклонён'),
  }
  return labels[status]
}

async function deleteCatalogPlugin(id: number) {
  try {
    await repos.catalogPlugin.delete(id)
    toast.success(t('settings.catalogPluginDeleted', 'Плагин удалён из каталога'))
    await Promise.all([
      fetchMyUploadedPlugins(),
      ...(isAdmin.value ? [fetchPendingPlugins()] : []),
    ])
  }
  catch (err) {
    console.error('Failed to delete catalog plugin:', err)
    toast.error(t('settings.catalogActionFailed', 'Не удалось выполнить действие'))
  }
}

async function moderatePlugin(record: CatalogPluginRecord, status: 'approved' | 'rejected') {
  try {
    await repos.catalogPlugin.updateStatus(record.id, status)
    toast.success(t('settings.catalogPluginStatusUpdated', 'Статус плагина обновлён'))
    await fetchPendingPlugins()
  }
  catch (err) {
    console.error('Failed to moderate plugin:', err)
    toast.error(t('settings.catalogActionFailed', 'Не удалось выполнить действие'))
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
      <div class="panel-actions">
        <KitBtn
          variant="tonal"
          icon="mdi:account-group-outline"
          size="sm"
          @click="openCatalogModal"
        >
          {{ t('settings.communityPlugins', 'Плагины сообщества') }}
        </KitBtn>
        <KitBtn
          variant="tonal"
          icon="mdi:upload-outline"
          size="sm"
          @click="openUploadModal"
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
          @click="openInstallModal"
        />
      </div>
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
              color="error"
              icon="mdi:delete-outline"
              size="sm"
              @click="uninstallRemotePlugin(record.pluginId)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Мои загруженные в каталог плагины -->
    <div v-if="myUploadedPlugins.length > 0" class="section-group">
      <h3 class="group-title">
        {{ t('settings.myUploadedPlugins', 'Мои загруженные плагины') }}
      </h3>
      <div class="plugins-list">
        <div v-for="record in myUploadedPlugins" :key="record.id" class="plugin-card">
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
              @click="deleteCatalogPlugin(record.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Модерация (только для администратора) -->
    <div v-if="isAdmin" class="section-group">
      <h3 class="group-title">
        {{ t('settings.moderationTitle', 'Модерация') }}
      </h3>

      <div v-if="pendingPlugins.length === 0" class="empty-state">
        <Icon icon="mdi:shield-check-outline" class="empty-icon" />
        <p>{{ t('settings.noPendingPlugins', 'Нет плагинов на модерации') }}</p>
      </div>

      <div v-else class="plugins-list">
        <div v-for="record in pendingPlugins" :key="record.id" class="plugin-card">
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
              @click="moderatePlugin(record, 'approved')"
            />
            <KitBtn
              variant="tonal"
              color="error"
              icon="mdi:close"
              size="sm"
              :title="t('settings.rejectPlugin', 'Отклонить')"
              @click="moderatePlugin(record, 'rejected')"
            />
            <KitBtn
              variant="text"
              color="error"
              icon="mdi:delete-outline"
              size="sm"
              :title="t('settings.deleteCatalogPlugin', 'Удалить')"
              @click="deleteCatalogPlugin(record.id)"
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
    <!-- Модальное окно каталога плагинов сообщества -->
    <KitDialog
      v-model:visible="isCatalogModalOpen"
      :title="t('settings.communityPluginsTitle', 'Каталог плагинов сообщества')"
      :max-width="640"
    >
      <div class="install-dialog-content">
        <div v-if="isCatalogLoading" class="empty-state">
          <Icon icon="mdi:loading" class="empty-icon rotating" />
        </div>

        <div v-else-if="catalogPlugins.length === 0" class="empty-state">
          <Icon icon="mdi:puzzle-remove-outline" class="empty-icon" />
          <p>{{ t('settings.noCommunityPlugins', 'В каталоге пока нет одобренных плагинов') }}</p>
        </div>

        <div v-else class="plugins-list">
          <div v-for="record in catalogPlugins" :key="record.id" class="plugin-card">
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
                v-if="isCatalogPluginInstalled(record)"
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

    <!-- Модальное окно загрузки своего плагина -->
    <KitDialog
      v-model:visible="isUploadModalOpen"
      :title="t('settings.uploadPluginTitle', 'Загрузка своего плагина')"
      :max-width="540"
    >
      <div class="install-dialog-content">
        <p class="upload-hint">
          {{ t('settings.uploadPluginHint', 'Выберите zip-архив с плагином. После загрузки он будет отправлен на рассмотрение модератором.') }}
        </p>

        <div class="field-group">
          <label>{{ t('settings.uploadPluginFileLabel', 'Zip-архив плагина:') }}</label>
          <input
            type="file"
            accept=".zip"
            class="file-input"
            @change="onUploadFileChange"
          >
        </div>

        <div class="dialog-actions">
          <KitBtn variant="tonal" size="sm" @click="isUploadModalOpen = false">
            {{ t('common.cancel', 'Отмена') }}
          </KitBtn>
          <KitBtn
            color="primary"
            size="sm"
            :loading="isUploading"
            @click="confirmUploadPlugin"
          >
            {{ t('settings.uploadConfirm', 'Отправить на рассмотрение') }}
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

.plugin-author {
  font-size: 0.8rem;
  color: var(--fg-muted-color);
}

.upload-hint {
  margin: 0;
  font-size: 0.9rem;
  color: var(--fg-secondary-color);
  line-height: 1.4;
}

.file-input {
  font-size: 0.9rem;
  color: var(--fg-primary-color);

  &::file-selector-button {
    margin-right: 12px;
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    background: var(--bg-tertiary-color);
    color: var(--fg-primary-color);
    cursor: pointer;
  }
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
