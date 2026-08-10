<script setup lang="ts">
import type { DashboardStats } from '~/01.shared/types/models'
import { Icon } from '@iconify/vue'
import { onMounted, ref } from 'vue'
import { useRepos } from '~/00.plugins/di'
import KitSkeleton from '~/02.kit/atoms/kit-skeleton.vue'
import KitStatCard from '~/02.kit/organisms/kit-stat-card.vue'

const { admin } = useRepos()

const stats = ref<DashboardStats | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    stats.value = await admin.stats()
  }
  catch {
    /* ignore */
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h1 class="dashboard-stats__title">
      <Icon icon="mdi:view-dashboard" class="dashboard-stats__title-icon" />
      <span>Дашборд</span>
    </h1>

    <div v-if="loading" class="dashboard-stats__grid">
      <KitSkeleton type="stat-card" :count="4" />
    </div>

    <div v-else-if="stats" class="dashboard-stats__grid">
      <KitStatCard :value="stats.totalUsers" label="Всего пользователей" />
      <KitStatCard :value="stats.totalBooks" label="Всего книг" />
      <KitStatCard :value="stats.pendingBooks" label="Книг на модерации" value-color="#b38f2b" />
      <KitStatCard :value="stats.pendingPlugins" label="Плагинов на модерации" value-color="#b38f2b" />
    </div>

    <div class="dashboard-stats__links">
      <RouterLink to="/users" class="dashboard-stats__link">
        <Icon icon="mdi:account-group" class="dashboard-stats__link-icon" />
        <span>Управление пользователями</span>
      </RouterLink>
      <RouterLink to="/books/pending" class="dashboard-stats__link">
        <Icon icon="mdi:book-open-variant" class="dashboard-stats__link-icon" />
        <span>Модерация книг</span>
      </RouterLink>
      <RouterLink to="/plugins/pending" class="dashboard-stats__link">
        <Icon icon="mdi:puzzle" class="dashboard-stats__link-icon" />
        <span>Модерация плагинов</span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.dashboard-stats__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--fg-primary-color, #4a443c);
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.dashboard-stats__title-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 28px;
}
.dashboard-stats__grid {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
}
.dashboard-stats__links {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.dashboard-stats__link {
  text-decoration: none;
  color: var(--fg-primary-color, #4a443c);
  font-size: 16px;
  font-weight: 500;
  background: var(--bg-secondary-color, #e8e2d9);
  border: 1px solid var(--border-secondary-color, #d9d1c7);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 220px;
  transition:
    border-color 0.15s,
    transform 0.15s;
}
.dashboard-stats__link:hover {
  border-color: var(--border-accent-color, #5a9c7b);
  transform: translateY(-2px);
}
.dashboard-stats__link-icon {
  font-size: 24px;
  color: var(--fg-accent-color, #4b8266);
  flex-shrink: 0;
}
</style>
