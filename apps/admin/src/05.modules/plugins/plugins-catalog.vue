<script setup lang="ts">
import type { CatalogPlugin } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBadge from '~/02.kit/atoms/kit-badge.vue'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitInput from '~/02.kit/atoms/kit-input.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'

const { admin } = useRepos()

const plugins = ref<CatalogPlugin[]>([])
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')
const search = ref('')
const selectedStatus = ref<'all' | 'approved' | 'rejected' | 'pending'>('all')

const statusCounts = computed(() => {
  const counts = { all: plugins.value.length, approved: 0, rejected: 0, pending: 0 }
  for (const p of plugins.value) {
    if (p.status in counts) {
      counts[p.status as 'approved' | 'rejected' | 'pending']++
    }
  }

  return counts
})

const filteredPlugins = computed(() => {
  return plugins.value.filter((p) => {
    if (selectedStatus.value !== 'all' && p.status !== selectedStatus.value) {
      return false
    }

    if (search.value.trim()) {
      const q = search.value.trim().toLowerCase()
      const matchId = p.id.toLowerCase().includes(q)
      const matchName = p.name.toLowerCase().includes(q)
      const matchAuthor = p.author ? p.author.toLowerCase().includes(q) : false
      const matchDesc = p.description ? p.description.toLowerCase().includes(q) : false

      return matchId || matchName || matchAuthor || matchDesc
    }

    return true
  })
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    plugins.value = await admin.listPlugins()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}

async function handleStatusChange(pluginId: string, status: 'approved' | 'rejected') {
  actionMsg.value = ''
  try {
    await admin.setPluginStatus(pluginId, status)
    actionMsg.value = `Статус плагина "${pluginId}" изменён на "${status === 'approved' ? 'одобрен' : 'отклонён / отозван'}"`
    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

async function handleDelete(p: CatalogPlugin) {
  if (!confirm(`Вы действительно хотите удалить плагин "${p.name}" (${p.id}) из каталога? Все файлы плагина будут удалены.`)) {
    return
  }

  actionMsg.value = ''
  try {
    await admin.deletePlugin(p.id)
    actionMsg.value = `Плагин "${p.name}" успешно удалён из каталога`
    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

async function handleDownload(p: CatalogPlugin) {
  try {
    const blob = await admin.downloadPlugin(p.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${p.id}-v${p.version}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

function statusBadgeVariant(status: CatalogPlugin['status']): 'approved' | 'rejected' | 'pending' {
  if (status === 'approved')
    return 'approved'
  if (status === 'rejected')
    return 'rejected'

  return 'pending'
}

function statusLabel(status: CatalogPlugin['status']): string {
  if (status === 'approved')
    return 'Одобрен'
  if (status === 'rejected')
    return 'Отозван / Отклонён'

  return 'На модерации'
}

onMounted(() => load())
</script>

<template>
  <div class="plugins-catalog">
    <div class="plugins-catalog__header">
      <h1 class="plugins-catalog__title">
        <Icon icon="mdi:puzzle-outline" class="plugins-catalog__title-icon" />
        <span>Каталог плагинов</span>
        <span v-if="!loading" class="plugins-catalog__count-badge">
          {{ filteredPlugins.length }}
        </span>
      </h1>

      <RouterLink to="/plugins/pending" class="plugins-catalog__pending-link">
        <Icon icon="mdi:clock-outline" />
        <span>На модерации ({{ statusCounts.pending }})</span>
      </RouterLink>
    </div>

    <div class="plugins-catalog__toolbar">
      <KitInput
        v-model="search"
        placeholder="Поиск по названию, ID или автору..."
        style="max-width: 360px;"
      />

      <div class="plugins-catalog__filters">
        <button
          class="filter-pill"
          :class="{ 'filter-pill--active': selectedStatus === 'all' }"
          @click="selectedStatus = 'all'"
        >
          Все ({{ statusCounts.all }})
        </button>
        <button
          class="filter-pill"
          :class="{ 'filter-pill--active': selectedStatus === 'approved' }"
          @click="selectedStatus = 'approved'"
        >
          Одобренные ({{ statusCounts.approved }})
        </button>
        <button
          class="filter-pill"
          :class="{ 'filter-pill--active': selectedStatus === 'rejected' }"
          @click="selectedStatus = 'rejected'"
        >
          Отозванные / Отклонённые ({{ statusCounts.rejected }})
        </button>
        <button
          class="filter-pill"
          :class="{ 'filter-pill--active': selectedStatus === 'pending' }"
          @click="selectedStatus = 'pending'"
        >
          На модерации ({{ statusCounts.pending }})
        </button>
      </div>
    </div>

    <KitError v-if="error" :message="error" />
    <div v-if="actionMsg" class="plugins-catalog__success">
      {{ actionMsg }}
    </div>

    <table v-if="loading || filteredPlugins.length" class="plugins-catalog__table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Название</th>
          <th>Версия</th>
          <th>Статус</th>
          <th>Автор</th>
          <th>Описание</th>
          <th>Дата</th>
          <th style="width: 150px; text-align: right;">
            Действия
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="i in 5" :key="i">
          <td><KitSkeleton width="80px" height="16px" /></td>
          <td><KitSkeleton width="140px" height="16px" /></td>
          <td><KitSkeleton width="45px" height="16px" /></td>
          <td><KitSkeleton width="70px" height="20px" border-radius="4px" /></td>
          <td><KitSkeleton width="90px" height="16px" /></td>
          <td><KitSkeleton width="160px" height="16px" /></td>
          <td><KitSkeleton width="75px" height="16px" /></td>
          <td>
            <div class="plugins-catalog__actions">
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
            </div>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="p in filteredPlugins" :key="p.id">
          <td class="plugins-catalog__mono">
            {{ p.id }}
          </td>
          <td class="plugins-catalog__bold">
            <div class="plugins-catalog__name-cell">
              <Icon v-if="p.icon" :icon="p.icon" class="plugins-catalog__plugin-icon" />
              <span>{{ p.name }}</span>
            </div>
          </td>
          <td>
            <span class="plugins-catalog__version">v{{ p.version }}</span>
          </td>
          <td>
            <KitBadge :variant="statusBadgeVariant(p.status)">
              {{ statusLabel(p.status) }}
            </KitBadge>
          </td>
          <td class="plugins-catalog__muted">
            {{ p.author || '—' }}
          </td>
          <td class="plugins-catalog__muted plugins-catalog__desc" :title="p.description || ''">
            {{ p.description || '—' }}
          </td>
          <td class="plugins-catalog__muted plugins-catalog__small">
            {{ new Date(p.updatedAt || p.createdAt).toLocaleDateString('ru-RU') }}
          </td>
          <td>
            <div class="plugins-catalog__actions">
              <a
                v-if="p.sourceUrl"
                :href="p.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="plugins-catalog__link-btn"
                title="Исходный код плагина"
              >
                <Icon icon="mdi:code-tags" />
              </a>

              <KitBtn
                variant="ghost"
                style="padding: 4px 6px; font-size: 14px"
                title="Скачать плагин (zip)"
                @click="handleDownload(p)"
              >
                <Icon icon="mdi:download" />
              </KitBtn>

              <!-- Если одобрен: кнопка отозвать -->
              <KitBtn
                v-if="p.status === 'approved'"
                variant="ghost-danger"
                style="padding: 4px 6px; font-size: 14px"
                title="Отозвать плагин (отклонить)"
                @click="handleStatusChange(p.id, 'rejected')"
              >
                <Icon icon="mdi:cancel" />
              </KitBtn>

              <!-- Если отклонён/отозван: кнопка одобрить -->
              <KitBtn
                v-if="p.status === 'rejected'"
                variant="ghost-success"
                style="padding: 4px 6px; font-size: 14px"
                title="Одобрить плагин"
                @click="handleStatusChange(p.id, 'approved')"
              >
                <Icon icon="mdi:thumb-up" />
              </KitBtn>

              <!-- Если на рассмотрении: кнопки одобрить и отклонить -->
              <template v-if="p.status === 'pending'">
                <KitBtn
                  variant="ghost-success"
                  style="padding: 4px 6px; font-size: 14px"
                  title="Одобрить"
                  @click="handleStatusChange(p.id, 'approved')"
                >
                  <Icon icon="mdi:thumb-up" />
                </KitBtn>
                <KitBtn
                  variant="ghost-danger"
                  style="padding: 4px 6px; font-size: 14px"
                  title="Отклонить"
                  @click="handleStatusChange(p.id, 'rejected')"
                >
                  <Icon icon="mdi:thumb-down" />
                </KitBtn>
              </template>

              <!-- Удаление плагина -->
              <KitBtn
                variant="ghost-danger"
                style="padding: 4px 6px; font-size: 14px"
                title="Удалить из каталога"
                @click="handleDelete(p)"
              >
                <Icon icon="mdi:delete-outline" />
              </KitBtn>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && !filteredPlugins.length && !error" class="plugins-catalog__empty">
      {{ search || selectedStatus !== 'all' ? 'Ничего не найдено по выбранным фильтрам' : 'В каталоге пока нет плагинов' }}
    </div>
  </div>
</template>

<style scoped>
.plugins-catalog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.plugins-catalog__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.plugins-catalog__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}

.plugins-catalog__count-badge {
  font-size: 13px;
  font-weight: 500;
  background: var(--bg-tertiary-color, #d9d1c7);
  color: var(--fg-secondary-color, #8e867b);
  padding: 2px 8px;
  border-radius: 12px;
}

.plugins-catalog__pending-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-accent-color, #4b8266);
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  padding: 6px 12px;
  border-radius: 6px;
  text-decoration: none;
  transition:
    background-color 0.15s,
    border-color 0.15s;
}

.plugins-catalog__pending-link:hover {
  background: var(--bg-tertiary-color, #d9d1c7);
  border-color: var(--border-primary-color, #c7c0b6);
}

.plugins-catalog__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.plugins-catalog__filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-pill {
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  background: var(--bg-secondary-color, #e8e2d9);
  color: var(--fg-secondary-color, #8e867b);
  font-size: 13px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-pill:hover {
  background: var(--bg-tertiary-color, #d9d1c7);
  color: var(--fg-primary-color, #4a443c);
}

.filter-pill--active {
  background: var(--fg-accent-color, #4b8266) !important;
  color: #ffffff !important;
  border-color: var(--fg-accent-color, #4b8266) !important;
}

.plugins-catalog__success {
  color: var(--fg-success-color, #4b8266);
  font-size: 14px;
  margin-top: 8px;
  margin-bottom: 12px;
}

.plugins-catalog__table {
  width: 100%;
  border-collapse: collapse;
}

.plugins-catalog__table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
}

.plugins-catalog__table td {
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  vertical-align: middle;
}

.plugins-catalog__table tr:hover td {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}

.plugins-catalog__mono {
  font-family: monospace;
  font-size: 13px;
}

.plugins-catalog__bold {
  font-weight: 500;
}

.plugins-catalog__name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.plugins-catalog__plugin-icon {
  font-size: 18px;
  color: var(--fg-accent-color, #4b8266);
  flex-shrink: 0;
}

.plugins-catalog__version {
  font-family: monospace;
  font-size: 12px;
  background: var(--bg-tertiary-color, #d9d1c7);
  padding: 2px 6px;
  border-radius: 4px;
}

.plugins-catalog__muted {
  color: var(--fg-secondary-color, #8e867b);
}

.plugins-catalog__small {
  font-size: 13px;
}

.plugins-catalog__desc {
  font-size: 13px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugins-catalog__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.plugins-catalog__link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  font-size: 16px;
  color: var(--fg-secondary-color, #8e867b);
  border-radius: 4px;
  text-decoration: none;
  transition:
    color 0.15s,
    background-color 0.15s;
}

.plugins-catalog__link-btn:hover {
  color: var(--fg-accent-color, #4b8266);
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}

.plugins-catalog__empty {
  color: var(--fg-secondary-color, #8e867b);
  text-align: center;
  padding: 40px;
}
</style>
