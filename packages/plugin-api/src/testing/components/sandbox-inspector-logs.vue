<script setup lang="ts">
import { Icon } from '@iconify/vue'

interface Props {
  notifications: any[]
  apiLogs: any[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'clearNotifications'): void
  (e: 'clearLogs'): void
}>()
</script>

<template>
  <div class="inspector-view">
    <!-- Notifications Log -->
    <div class="inspector-panel">
      <div class="panel-header">
        <h2>
          <span class="panel-icon"><Icon icon="mdi:bell-outline" /></span>
          Notifications Log
          <span class="count-badge">{{ notifications.length }}</span>
        </h2>
        <button
          class="clear-btn"
          :disabled="notifications.length === 0"
          @click="emit('clearNotifications')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          Clear
        </button>
      </div>
      <ul v-if="notifications.length > 0" class="notification-list">
        <li
          v-for="n in notifications"
          :key="n.id"
          class="notif-item"
          :class="[n.type]"
        >
          <span class="notif-time">{{ n.timestamp.toLocaleTimeString() }}</span>
          <span class="notif-type">[{{ n.type }}]</span>
          <span class="notif-msg">{{ n.message }}</span>
        </li>
      </ul>
      <div v-else class="empty-log">
        <span>No notifications yet</span>
      </div>
    </div>

    <!-- API Call History -->
    <div class="inspector-panel">
      <div class="panel-header">
        <h2>
          <span class="panel-icon"><Icon icon="mdi:flash-outline" /></span>
          API Call History
          <span class="count-badge">{{ apiLogs.length }}</span>
        </h2>
        <button
          class="clear-btn"
          :disabled="apiLogs.length === 0"
          @click="emit('clearLogs')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          Clear
        </button>
      </div>
      <ul v-if="apiLogs.length > 0" class="api-log-list">
        <li v-for="log in apiLogs" :key="log.id" class="api-log-item">
          <span class="log-time">{{ log.timestamp.toLocaleTimeString() }}</span>
          <span class="log-method">{{ log.method }}</span>
          <span class="log-args">{{ JSON.stringify(log.args) }}</span>
        </li>
      </ul>
      <div v-else class="empty-log">
        <span>No API calls logged yet</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inspector-view {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  flex: 1;
}

.inspector-panel {
  background: var(--bg-elevated);
  border-radius: 10px;
  border: 1px solid var(--border);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  gap: 12px;
}

.panel-header h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.panel-icon {
  font-size: 14px;
  display: flex;
  align-items: center;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 22px;
}

.clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-btn svg {
  width: 13px;
  height: 13px;
}

.clear-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.6);
  transform: translateY(-1px);
}

.clear-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.notification-list {
  list-style: none;
  padding: 10px 12px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.notif-item {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.notif-item.info {
  background: #1e1b4b;
  color: #a5b4fc;
}
.notif-item.success {
  background: #064e3b;
  color: #6ee7b7;
}
.notif-item.warning {
  background: #451a03;
  color: #fde047;
}
.notif-item.error {
  background: #4c0519;
  color: #fda4af;
}

.notif-time {
  font-size: 10px;
  opacity: 0.7;
}

.notif-type {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 10px;
}

.api-log-list {
  list-style: none;
  padding: 10px 12px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 280px;
  overflow-y: auto;
}

.api-log-item {
  font-family: monospace;
  font-size: 11.5px;
  background: var(--bg-surface);
  padding: 7px 10px;
  border-radius: 5px;
  display: flex;
  gap: 12px;
  align-items: baseline;
  border: 1px solid var(--border-subtle);
}

.log-time {
  color: var(--text-muted);
  font-size: 10px;
}

.log-method {
  color: #38bdf8;
  font-weight: 700;
}

.log-args {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-log {
  padding: 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
