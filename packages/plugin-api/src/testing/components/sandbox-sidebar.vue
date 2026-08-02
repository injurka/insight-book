<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

interface Props {
  isSidebarOpen: boolean
  isFullscreen: boolean
  pages: Record<string, any>
  widgets: Record<string, any>
  activeTab: 'pages' | 'widgets' | 'logs'
  selectedPageKey: string
  selectedWidgetId: string | null
  apiLogsCount: number
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'closeSidebar'): void
  (e: 'update:activeTab', tab: 'pages' | 'widgets' | 'logs'): void
  (e: 'update:selectedPageKey', key: string): void
  (e: 'update:selectedWidgetId', id: string | null): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="sidebar-wrapper">
    <!-- Sidebar backdrop -->
    <Transition name="backdrop-fade">
      <div v-if="isSidebarOpen && !isFullscreen" class="sidebar-backdrop" @click="emit('closeSidebar')" />
    </Transition>

    <!-- Sidebar Navigation (popover) -->
    <Transition name="sidebar-slide">
      <aside v-if="isSidebarOpen && !isFullscreen" class="sandbox-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">{{ t('sandbox.navigation') }}</span>
          <button class="icon-btn sidebar-close-btn" @click="emit('closeSidebar')">
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div class="sidebar-content">
          <div class="sidebar-section">
            <h3>{{ t('sandbox.pages') }} ({{ Object.keys(pages).length }})</h3>
            <ul>
              <li
                v-for="(_, key) in pages"
                :key="key"
                :class="{ active: activeTab === 'pages' && selectedPageKey === key }"
                @click="emit('update:activeTab', 'pages'); emit('update:selectedPageKey', key); emit('closeSidebar')"
              >
                <Icon icon="mdi:file-document-outline" />
                {{ key }}
              </li>
            </ul>
          </div>

          <div class="sidebar-section">
            <h3>{{ t('sandbox.widgets') }} ({{ Object.keys(widgets).length }})</h3>
            <ul v-if="Object.keys(widgets).length > 0">
              <li
                v-for="widget in widgets"
                :key="widget.id"
                :class="{ active: activeTab === 'widgets' && selectedWidgetId === widget.id }"
                @click="emit('update:activeTab', 'widgets'); emit('update:selectedWidgetId', widget.id); emit('closeSidebar')"
              >
                <Icon icon="mdi:puzzle-outline" class="widget-icon" />
                <div class="widget-info">
                  <span class="widget-id">{{ widget.id }}</span>
                  <span class="widget-pos">{{ widget.position }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="empty-hint">
              {{ t('sandbox.noWidgets') }}
            </p>
          </div>

          <div class="sidebar-section dev-tab-trigger">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'logs' }"
              @click="emit('update:activeTab', 'logs'); emit('closeSidebar')"
            >
              <Icon icon="mdi:chart-bar" />
              {{ t('sandbox.inspectorLogs') }}
              <span class="tab-badge" :class="{ hasItems: apiLogsCount > 0 }">{{ apiLogsCount }}</span>
            </button>
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.sandbox-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 500;
  width: 280px;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 8px 0 32px rgba(0, 0, 0, 0.35);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sidebar-section {
  padding: 12px 14px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 12px;
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 499;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 0.22s ease;
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}

.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
}

.sidebar-section h3 {
  margin: 0 0 4px;
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.8px;
  font-weight: 700;
}

.sidebar-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-section li {
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  background: transparent;
  border: 1px solid transparent;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.sidebar-section li:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.sidebar-section li.active {
  background: var(--accent);
  color: white;
  border-color: transparent;
}

.widget-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.widget-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.widget-id {
  font-weight: 500;
  font-size: 13px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.widget-pos {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-section li.active .widget-id {
  color: #ffffff;
}

.sidebar-section li.active .widget-pos {
  color: rgba(255, 255, 255, 0.7);
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

.tab-btn {
  width: 100%;
  padding: 10px 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.tab-btn:hover {
  border-color: var(--accent);
}

.tab-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
}

.tab-badge {
  margin-left: auto;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
  transition: all 0.2s;
}

.tab-badge.hasItems {
  background: #3b82f6;
  color: white;
}

.tab-btn.active .tab-badge {
  background: rgba(255, 255, 255, 0.25);
  color: white;
}
</style>
