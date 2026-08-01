<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  pluginName: string
  pluginVersion: string
  isActive: boolean
  isDark: boolean
  isFullscreen: boolean
  isSidebarOpen: boolean
  locale: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:isDark', val: boolean): void
  (e: 'update:locale', val: string): void
  (e: 'toggleSidebar'): void
  (e: 'toggleActivation'): void
  (e: 'enterFullscreen'): void
}>()
</script>

<template>
  <header class="sandbox-header">
    <button
      class="icon-btn menu-btn"
      :class="{ active: isSidebarOpen }"
      title="Меню"
      @click="emit('toggleSidebar')"
    >
      <Icon :icon="isSidebarOpen ? 'mdi:close' : 'mdi:menu'" />
    </button>

    <div class="header-brand">
      <span class="sandbox-badge">
        <Icon icon="mdi:layers-triple" />
        InsightBook Sandbox
      </span>
      <h1 class="plugin-title">
        {{ pluginName }}
        <span class="plugin-version">v{{ pluginVersion }}</span>
      </h1>
    </div>

    <div class="header-controls">
      <button class="status-button" :class="{ active: isActive }" @click="emit('toggleActivation')">
        <span class="status-dot" />
        {{ isActive ? 'Activated' : 'Deactivated' }}
      </button>

      <div class="locale-selector">
        <select
          id="sandbox-locale-select"
          :value="locale"
          @change="emit('update:locale', ($event.target as HTMLSelectElement).value)"
        >
          <option value="ru">
            RU
          </option>
          <option value="en">
            EN
          </option>
          <option value="zh">
            ZH
          </option>
        </select>
      </div>

      <button
        class="icon-btn"
        :title="isDark ? 'Светлая тема' : 'Тёмная тема'"
        @click="emit('update:isDark', !isDark)"
      >
        <Icon :icon="isDark ? 'mdi:weather-sunny' : 'mdi:weather-night'" />
      </button>

      <button class="icon-btn" title="Полноэкранный режим плагина" @click="emit('enterFullscreen')">
        <Icon icon="mdi:fullscreen" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.sandbox-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  gap: 16px;
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  width: 100%;
}

.sandbox-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
}

.plugin-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plugin-version {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
  margin-left: 4px;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
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
  background: var(--bg-elevated);
}

.menu-btn {
  flex-shrink: 0;
}

.menu-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(59, 130, 246, 0.1);
}

.locale-selector select {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 13px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.locale-selector select:hover,
.locale-selector select:focus {
  border-color: var(--accent);
}

.status-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  padding: 6px 14px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
}

.status-button.active {
  background: var(--success-bg);
  color: var(--success-text);
  border-color: transparent;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all 0.2s;
}

.status-button.active .status-dot {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}
</style>
