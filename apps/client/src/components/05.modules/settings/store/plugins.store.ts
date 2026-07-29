import type { Router } from 'vue-router'
import type { CatalogPluginRecord, UserPluginRecord } from '~/shared/types/models'
import { useMutation, useQuery } from '@pinia/colada'
import { useToast } from '~/shared/composables/use-toast'
import { queryKeys } from '~/shared/lib/query-keys'
import { useRepos } from '~/shared/plugins/di'
import { i18n } from '~/shared/plugins/i18n'
import { pluginManager } from '~/shared/plugins/plugin-manager'
import { useAuthStore } from '~/shared/store/auth.store'

// Динамический импорт во избежание циклической зависимости router -> views -> store
async function getRouter(): Promise<Router> {
  return (await import('~/shared/lib/router')).default
}

export const usePluginsStore = defineStore('settings-plugins', () => {
  const toast = useToast()
  const repos = useRepos()
  const authStore = useAuthStore()
  const t = i18n.global.t

  const isAdmin = computed(() => authStore.user?.role === 'admin')
  const isCatalogRequested = ref(false)

  // --- QUERY: Установленные пользователем динамические плагины ---
  const {
    data: remotePluginsData,
    isLoading: isRemotePluginsLoading,
    refetch: refetchRemotePlugins,
  } = useQuery<UserPluginRecord[]>({
    key: queryKeys.plugins.my,
    query: () => repos.plugin.getMyPlugins(),
  })
  const remotePlugins = computed(() => remotePluginsData.value ?? [])

  // --- QUERY: Мои загруженные в каталог плагины ---
  const {
    data: myUploadedPluginsData,
    refetch: refetchMyUploadedPlugins,
  } = useQuery<CatalogPluginRecord[]>({
    key: queryKeys.plugins.catalogMine,
    query: () => repos.catalogPlugin.getMy(),
  })
  const myUploadedPlugins = computed(() => myUploadedPluginsData.value ?? [])

  // --- QUERY: Плагины на модерации (только админ) ---
  const {
    data: pendingPluginsData,
    refetch: refetchPendingPlugins,
  } = useQuery<CatalogPluginRecord[]>({
    key: queryKeys.plugins.catalogPending,
    query: () => repos.catalogPlugin.getPending(),
    enabled: () => isAdmin.value,
  })
  const pendingPlugins = computed(() => pendingPluginsData.value ?? [])

  // --- QUERY: Каталог одобренных плагинов (по запросу, при открытии модалки) ---
  const {
    data: catalogPluginsData,
    isLoading: isCatalogLoading,
    refetch: refetchCatalogPlugins,
  } = useQuery<CatalogPluginRecord[]>({
    key: queryKeys.plugins.catalogApproved,
    query: () => repos.catalogPlugin.getApproved(),
    enabled: () => isCatalogRequested.value,
  })
  const catalogPlugins = computed(() => catalogPluginsData.value ?? [])

  function loadCatalog() {
    if (isCatalogRequested.value)
      refetchCatalogPlugins()
    else
      isCatalogRequested.value = true
  }

  function isCatalogPluginInstalled(record: CatalogPluginRecord) {
    return remotePlugins.value.some(p => p.manifestUrl === record.manifestUrl)
  }

  // --- MUTATION: Установка динамического плагина по URL манифеста ---
  const {
    mutateAsync: installPluginByUrlMutation,
    isLoading: isInstallingPlugin,
  } = useMutation({
    mutation: async (manifestUrl: string) => {
      const router = await getRouter()
      const loadedPlugin = await pluginManager.loadRemotePlugin(manifestUrl, router)
      if (!loadedPlugin)
        return null

      await repos.plugin.installPlugin({
        pluginId: loadedPlugin.id,
        manifestUrl,
        isEnabled: true,
      })
      return loadedPlugin
    },
    onSuccess(loadedPlugin) {
      if (!loadedPlugin) {
        toast.error(t('settings.plugins.installFailed', 'Не удалось загрузить плагин по указанному URL'))
        return
      }
      toast.success(t('settings.plugins.installSuccess', { name: loadedPlugin.name }))
      refetchRemotePlugins()
    },
    onError(err) {
      console.error('Failed to install plugin:', err)
      toast.error(err instanceof Error ? err.message : 'Ошибка при установке плагина')
    },
  })

  async function installPluginByUrl(manifestUrl: string): Promise<boolean> {
    try {
      return !!(await installPluginByUrlMutation(manifestUrl))
    }
    catch {
      return false
    }
  }

  // --- MUTATION: Переключение состояния динамического плагина ---
  const { mutateAsync: toggleRemotePluginMutation } = useMutation({
    mutation: async ({ record, enabled }: { record: UserPluginRecord, enabled: boolean }) => {
      await repos.plugin.updatePlugin(record.pluginId, { isEnabled: enabled })
      const router = await getRouter()
      if (enabled)
        await pluginManager.loadRemotePlugin(record.manifestUrl, router)
      else
        await pluginManager.uninstall(record.pluginId, router)
    },
    onSuccess(_, { enabled }) {
      if (enabled)
        toast.success(t('settings.plugins.enabled', 'Плагин включен'))
      else
        toast.info(t('settings.plugins.disabled', 'Плагин отключен'))
      refetchRemotePlugins()
    },
    onError(err) {
      console.error('Failed to toggle plugin state:', err)
      toast.error('Не удалось изменить состояние плагина')
    },
  })

  async function toggleRemotePlugin(record: UserPluginRecord, enabled: boolean) {
    try {
      await toggleRemotePluginMutation({ record, enabled })
    }
    catch { }
  }

  // --- MUTATION: Удаление динамического плагина ---
  const { mutateAsync: uninstallRemotePluginMutation } = useMutation({
    mutation: async (pluginId: string) => {
      await repos.plugin.uninstallPlugin(pluginId)
      const router = await getRouter()
      await pluginManager.uninstall(pluginId, router)
    },
    onSuccess() {
      toast.success(t('settings.plugins.uninstalled', 'Плагин удален'))
      refetchRemotePlugins()
    },
    onError(err) {
      console.error('Failed to uninstall remote plugin:', err)
      toast.error('Не удалось удалить плагин')
    },
  })

  async function uninstallRemotePlugin(pluginId: string) {
    try {
      await uninstallRemotePluginMutation(pluginId)
    }
    catch { }
  }

  // --- MUTATION: Загрузка своего плагина в каталог ---
  const {
    mutateAsync: uploadPluginMutation,
    isLoading: isUploadingPlugin,
  } = useMutation({
    mutation: (file: File) => repos.catalogPlugin.upload(file),
    onSuccess() {
      toast.success(t('settings.uploadPluginSuccess', 'Плагин отправлен на рассмотрение'))
      refetchMyUploadedPlugins()
    },
    onError(err) {
      console.error('Failed to upload plugin:', err)
      const msg = err instanceof Error ? err.message : t('settings.uploadPluginFailed', 'Не удалось загрузить плагин')
      toast.error(msg)
    },
  })

  async function uploadPlugin(file: File): Promise<boolean> {
    try {
      await uploadPluginMutation(file)
      return true
    }
    catch {
      return false
    }
  }

  // --- MUTATION: Удаление плагина из каталога ---
  const { mutateAsync: deleteCatalogPluginMutation } = useMutation({
    mutation: (id: number) => repos.catalogPlugin.delete(id),
    onSuccess() {
      toast.success(t('settings.catalogPluginDeleted', 'Плагин удалён из каталога'))
      refetchMyUploadedPlugins()
      if (isAdmin.value)
        refetchPendingPlugins()
    },
    onError(err) {
      console.error('Failed to delete catalog plugin:', err)
      toast.error(t('settings.catalogActionFailed', 'Не удалось выполнить действие'))
    },
  })

  async function deleteCatalogPlugin(id: number) {
    try {
      await deleteCatalogPluginMutation(id)
    }
    catch { }
  }

  // --- MUTATION: Модерация плагина каталога ---
  const { mutateAsync: moderatePluginMutation } = useMutation({
    mutation: ({ id, status }: { id: number, status: 'approved' | 'rejected' }) =>
      repos.catalogPlugin.updateStatus(id, status),
    onSuccess() {
      toast.success(t('settings.catalogPluginStatusUpdated', 'Статус плагина обновлён'))
      refetchPendingPlugins()
    },
    onError(err) {
      console.error('Failed to moderate plugin:', err)
      toast.error(t('settings.catalogActionFailed', 'Не удалось выполнить действие'))
    },
  })

  async function moderatePlugin(record: CatalogPluginRecord, status: 'approved' | 'rejected') {
    try {
      await moderatePluginMutation({ id: record.id, status })
    }
    catch { }
  }

  return {
    isAdmin,
    remotePlugins,
    isRemotePluginsLoading,
    myUploadedPlugins,
    pendingPlugins,
    catalogPlugins,
    isCatalogLoading,
    isInstallingPlugin,
    isUploadingPlugin,
    loadCatalog,
    isCatalogPluginInstalled,
    installPluginByUrl,
    toggleRemotePlugin,
    uninstallRemotePlugin,
    uploadPlugin,
    deleteCatalogPlugin,
    moderatePlugin,
  }
})
