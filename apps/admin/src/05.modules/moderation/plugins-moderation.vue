<script setup lang="ts">
import type { PendingPlugin } from '~/03.domain/plugin'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitError from '~/02.kit/organisms/kit-error.vue'

const { admin } = useRepos()

const plugins = ref<PendingPlugin[]>([])
const loading = ref(true)
const error = ref('')
const actionMsg = ref('')

async function load() {
  loading.value = true
  try {
    plugins.value = await admin.pendingPlugins()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}

async function handleAction(pluginId: string, status: 'approved' | 'rejected') {
  actionMsg.value = ''
  try {
    await admin.setPluginStatus(pluginId, status)
    actionMsg.value = `Плагин ${status === 'approved' ? 'одобрен' : 'отклонён'}`
    await load()
  }
  catch (e: unknown) {
    error.value = (e as Error).message
  }
}

async function handleDownload(p: PendingPlugin) {
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

onMounted(() => load())
</script>

<template>
  <div>
    <h1 class="moderation__title">
      <Icon icon="mdi:puzzle" class="moderation__title-icon" />
      <span>Плагины на модерацию</span>
    </h1>

    <KitError v-if="error" :message="error" />
    <div v-if="actionMsg" class="moderation__success">
      {{ actionMsg }}
    </div>

    <table v-if="loading || plugins.length" class="moderation__table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Название</th>
          <th>Версия</th>
          <th>Автор</th>
          <th>Описание</th>
          <th>Дата</th>
          <th style="width: 140px; text-align: right;">
            Действия
          </th>
        </tr>
      </thead>
      <tbody v-if="loading">
        <tr v-for="i in 5" :key="i">
          <td>
            <KitSkeleton width="80px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="140px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="45px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="90px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="160px" height="16px" />
          </td>
          <td>
            <KitSkeleton width="75px" height="16px" />
          </td>
          <td>
            <div class="moderation__actions">
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
              <KitSkeleton width="24px" height="24px" border-radius="4px" />
            </div>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="p in plugins" :key="p.id">
          <td class="moderation__mono">
            {{ p.id }}
          </td>
          <td class="moderation__bold">
            {{ p.name }}
          </td>
          <td>{{ p.version }}</td>
          <td class="moderation__muted">
            {{ p.author || '—' }}
          </td>
          <td class="moderation__muted moderation__desc">
            {{ p.description || '—' }}
          </td>
          <td class="moderation__muted moderation__small">
            {{ new Date(p.createdAt).toLocaleDateString('ru-RU') }}
          </td>
          <td>
            <div class="moderation__actions">
              <a
                v-if="p.sourceUrl"
                :href="p.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="moderation__link-btn"
                title="Исходный код плагина"
              >
                <Icon icon="mdi:code-tags" />
              </a>
              <KitBtn
                variant="ghost"
                style="padding: 4px 6px; font-size: 12px"
                title="Скачать плагин (zip)"
                @click="handleDownload(p)"
              >
                <Icon icon="mdi:download" />
              </KitBtn>
              <KitBtn
                variant="ghost-success"
                style="padding: 4px 6px; font-size: 12px"
                title="Одобрить"
                @click="handleAction(p.id, 'approved')"
              >
                <Icon icon="mdi:thumb-up" />
              </KitBtn>
              <KitBtn
                variant="ghost-danger"
                style="padding: 4px 6px; font-size: 12px"
                title="Отклонить"
                @click="handleAction(p.id, 'rejected')"
              >
                <Icon icon="mdi:thumb-down" />
              </KitBtn>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && !plugins.length && !error" class="moderation__empty">
      Нет плагинов на модерации
    </div>
  </div>
</template>

<style scoped>
.moderation__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.moderation__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}
.moderation__success {
  color: var(--fg-success-color, #4b8266);
  font-size: 14px;
  margin-top: 8px;
  margin-bottom: 12px;
}
.moderation__table {
  width: 100%;
  border-collapse: collapse;
}
.moderation__table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-secondary-color, #8e867b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-primary-color, #c7c0b6);
}
.moderation__table td {
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  vertical-align: middle;
}
.moderation__table tr:hover td {
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}
.moderation__bold {
  font-weight: 500;
}
.moderation__muted {
  color: var(--fg-secondary-color, #8e867b);
}
.moderation__small {
  font-size: 13px;
}
.moderation__mono {
  font-family: monospace;
  font-size: 13px;
}
.moderation__desc {
  font-size: 13px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.moderation__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.moderation__link-btn {
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
.moderation__link-btn:hover {
  color: var(--fg-accent-color, #4b8266);
  background: var(--bg-overlay-primary-color, rgba(142, 134, 123, 0.1));
}
.moderation__empty {
  color: var(--fg-secondary-color, #8e867b);
  text-align: center;
  padding: 40px;
}
.moderation__skeleton {
  padding: 0;
}
</style>
