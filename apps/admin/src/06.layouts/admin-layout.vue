<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import { useAuthStore } from '~/01.shared/store/auth.store'
import KitBtn from '~/02.kit/atoms/kit-btn.vue'

const auth = useAuthStore()

const isCollapsed = ref(localStorage.getItem('admin_sidebar_collapsed') === 'true')

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
  localStorage.setItem('admin_sidebar_collapsed', String(isCollapsed.value))
}

const navLinks = [
  { to: '/', label: 'Дашборд', icon: 'mdi:view-dashboard' },
  { to: '/users', label: 'Пользователи', icon: 'mdi:account-group' },
  { to: '/subscriptions', label: 'Подписки', icon: 'mdi:card-account-details' },
  { to: '/books/pending', label: 'Книги на модерацию', icon: 'mdi:book-open-variant' },
  { to: '/plugins/pending', label: 'Плагины на модерацию', icon: 'mdi:puzzle' },
]

function handleLogout() {
  auth.logout()
}
</script>

<template>
  <div class="admin-layout">
    <aside
      class="admin-layout__sidebar"
      :class="{ 'admin-layout__sidebar--collapsed': isCollapsed }"
    >
      <div class="admin-layout__header" :class="{ 'admin-layout__header--collapsed': isCollapsed }">
        <div class="admin-layout__title-group">
          <Icon icon="mdi:bookshelf" class="admin-layout__header-icon" />
          <div v-if="!isCollapsed" class="admin-layout__title-meta">
            <h1 class="admin-layout__title">
              InsightBook Admin
            </h1>
            <span v-if="auth.user" class="admin-layout__user-badge">
              {{ auth.user.username }} (admin)
            </span>
          </div>
        </div>
        <v-btn
          icon
          size="x-small"
          variant="tonal"
          class="admin-layout__toggle-btn"
          :title="isCollapsed ? 'Развернуть меню' : 'Свернуть меню'"
          @click.stop="toggleCollapse"
        >
          <Icon
            width="16"
            height="16"
            a
            :icon="isCollapsed ? 'mdi:chevron-right' : 'mdi:chevron-left'"
          />
        </v-btn>
      </div>

      <nav class="admin-layout__nav">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="admin-layout__link"
          :class="{ 'admin-layout__link--collapsed': isCollapsed }"
          :title="isCollapsed ? link.label : undefined"
        >
          <Icon :icon="link.icon" class="admin-layout__link-icon" />
          <span v-if="!isCollapsed" class="admin-layout__link-text">{{ link.label }}</span>
        </RouterLink>
      </nav>

      <div class="admin-layout__footer" :class="{ 'admin-layout__footer--collapsed': isCollapsed }">
        <KitBtn
          variant="ghost-danger"
          style="width: 100%"
          :title="isCollapsed ? 'Выйти' : undefined"
          @click="handleLogout"
        >
          <Icon icon="mdi:logout" />
          <span v-if="!isCollapsed">Выйти</span>
        </KitBtn>
      </div>
    </aside>

    <main class="admin-layout__content">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  width: 100%;
  background-color: var(--bg-primary-color, #f3efe9);
}

.admin-layout__sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--bg-secondary-color, #e8e2d9);
  border-right: 1px solid var(--border-secondary-color, #d9d1c7);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  position: sticky;
  top: 0;
  height: 100vh;
  flex-shrink: 0;
  transition:
    width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.admin-layout__sidebar--collapsed {
  width: 72px;
  min-width: 72px;
}

.admin-layout__header {
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--border-secondary-color, #d9d1c7);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.admin-layout__header--collapsed {
  padding: 0 12px 16px;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
}

.admin-layout__title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.admin-layout__header-icon {
  color: var(--fg-accent-color, #4b8266);
  font-size: 26px;
  flex-shrink: 0;
}

.admin-layout__title-meta {
  overflow: hidden;
  white-space: nowrap;
}

.admin-layout__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--fg-primary-color, #4a443c);
  margin: 0;
  line-height: 1.2;
}

.admin-layout__user-badge {
  font-size: 11px;
  color: var(--fg-secondary-color, #8e867b);
  display: block;
  margin-top: 2px;
}

.admin-layout__toggle-btn {
  color: var(--fg-secondary-color, #8e867b) !important;
  background-color: var(--bg-tertiary-color, #d9d1c7) !important;
  border-radius: 50% !important;
  flex-shrink: 0;
}

.admin-layout__toggle-btn:hover {
  color: var(--fg-accent-color, #4b8266) !important;
}

.admin-layout__nav {
  flex: 1;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.admin-layout__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  margin: 0 8px;
  border-radius: 6px;
  color: var(--fg-primary-color, #4a443c);
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;
  overflow: hidden;
}

.admin-layout__link--collapsed {
  justify-content: center;
  padding: 10px 0;
  margin: 0 12px;
}

.admin-layout__link-icon {
  font-size: 22px;
  color: var(--fg-secondary-color, #8e867b);
  flex-shrink: 0;
}

.admin-layout__link:hover,
.admin-layout__link.router-link-active {
  background: var(--bg-hover-color, #d9d1c7);
  color: var(--fg-primary-color, #4a443c);
}

.admin-layout__link:hover .admin-layout__link-icon,
.admin-layout__link.router-link-active .admin-layout__link-icon {
  color: var(--fg-accent-color, #4b8266);
}

.admin-layout__footer {
  padding: 0 16px;
  display: flex;
  justify-content: center;
}

.admin-layout__footer--collapsed {
  padding: 0 12px;
}

.admin-layout__footer--collapsed :deep(.kit-btn) {
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  padding: 0 !important;
  border-radius: 8px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.admin-layout__content {
  flex: 1;
  min-width: 0;
  padding: 32px;
  overflow-y: auto;
}
</style>
