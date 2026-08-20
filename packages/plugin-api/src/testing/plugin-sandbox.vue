<script setup lang="ts">
import type { InsightBookPlugin } from '../index'
import type { MockContextOptions } from '../testing/mock-context'
import { Icon } from '@iconify/vue'
import { computed, markRaw, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setPluginContext } from '../index'
import { createMockPluginContext } from '../testing/mock-context'

import SandboxHeader from './components/sandbox-header.vue'
import SandboxInspectorLogs from './components/sandbox-inspector-logs.vue'
import SandboxSidebar from './components/sandbox-sidebar.vue'
import SandboxWidgetStage from './components/sandbox-widget-stage.vue'

interface Props {
  plugin: InsightBookPlugin
  options?: MockContextOptions
}

const props = defineProps<Props>()

const mockRouter = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'root', component: { template: '<div/>' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: { template: '<div/>' } },
  ],
})
provide('router', mockRouter)

const mock = createMockPluginContext({
  ...props.options,
})

const i18n = useI18n({ useScope: 'global' })

watch(() => mock.translations, (newTranslations) => {
  for (const [locale, msgs] of Object.entries(newTranslations)) {
    i18n.mergeLocaleMessage(locale, {
      plugins: {
        [props.plugin.id]: msgs,
      },
    })
  }
}, { deep: true, immediate: true })

watch(() => mock.locale.value, (newLocale) => {
  i18n.locale.value = newLocale
}, { immediate: true })

const isActive = ref(false)
const activeTab = ref<'pages' | 'widgets' | 'logs'>('pages')
const selectedPageKey = ref<string>('index')
const selectedWidgetId = ref<string | null>(null)

const isDark = ref(typeof localStorage !== 'undefined'
  ? localStorage.getItem('insightbook-sandbox-theme') !== 'light'
  : true)

watch(isDark, (val) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('insightbook-sandbox-theme', val ? 'dark' : 'light')
  }
})

const isFullscreen = ref(false)
const isSidebarOpen = ref(false)

function enterFullscreen() {
  isFullscreen.value = true
}

function exitFullscreen() {
  isFullscreen.value = false
}

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}

function closeSidebar() {
  isSidebarOpen.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isFullscreen.value)
      exitFullscreen()
    else if (isSidebarOpen.value)
      closeSidebar()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  activatePlugin()
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

async function activatePlugin() {
  setPluginContext(mock.context)
  if (props.plugin.activate) {
    await props.plugin.activate(mock.context)
  }
  isActive.value = true
}

async function deactivatePlugin() {
  if (props.plugin.deactivate) {
    await props.plugin.deactivate(mock.context)
  }
  isActive.value = false
}

function toggleActivation() {
  if (isActive.value)
    deactivatePlugin()
  else activatePlugin()
}

const pages = computed(() => props.plugin.pages ?? {})
const activePageComponent = computed(() => {
  if (!pages.value || Object.keys(pages.value).length === 0)
    return null

  const rawComp = pages.value[selectedPageKey.value] ?? pages.value.index ?? Object.values(pages.value)[0]

  return rawComp ? markRaw(rawComp) : null
})

const activeWidget = computed(() => {
  if (!selectedWidgetId.value)
    return null
  return mock.widgets[selectedWidgetId.value] ?? null
})
</script>

<template>
  <div class="plugin-sandbox" :class="{ dark: isDark, light: !isDark, fullscreen: isFullscreen }">
    <!-- Floating exit fullscreen button -->
    <Transition name="fade-slide">
      <button
        v-if="isFullscreen"
        class="exit-fullscreen-fab"
        :title="i18n.t('sandbox.exitFullscreen')"
        @click="exitFullscreen"
      >
        <Icon icon="mdi:fullscreen-exit" />
      </button>
    </Transition>

    <!-- Header bar -->
    <Transition name="header-slide">
      <SandboxHeader
        v-if="!isFullscreen"
        v-model:is-dark="isDark"
        v-model:locale="mock.locale.value"
        :plugin-name="plugin.name"
        :plugin-version="plugin.version"
        :is-active="isActive"
        :is-fullscreen="isFullscreen"
        :is-sidebar-open="isSidebarOpen"
        @toggle-sidebar="toggleSidebar"
        @toggle-activation="toggleActivation"
        @enter-fullscreen="enterFullscreen"
      />
    </Transition>

    <!-- Main Workspace -->
    <div class="sandbox-body" :class="{ 'no-header': isFullscreen }">
      <!-- Sidebar Navigation -->
      <SandboxSidebar
        v-model:selected-page-key="selectedPageKey"
        v-model:selected-widget-id="selectedWidgetId"
        :is-sidebar-open="isSidebarOpen"
        :is-fullscreen="isFullscreen"
        :pages="pages"
        :widgets="mock.widgets"
        :active-tab="activeTab"
        :api-logs-count="mock.apiLogs.length"
        @close-sidebar="closeSidebar"
        @update:active-tab="activeTab = $event"
        @update:selected-page-key="selectedPageKey = $event"
        @update:selected-widget-id="selectedWidgetId = $event"
      />

      <!-- Main Stage -->
      <main class="sandbox-stage">
        <!-- Render Active Page -->
        <div v-if="activeTab === 'pages' || isFullscreen" class="stage-view">
          <div v-if="activePageComponent" class="view-container">
            <component :is="activePageComponent" />
          </div>
          <div v-else class="empty-state">
            {{ i18n.t('sandbox.noPages') }}
          </div>
        </div>

        <!-- Render Registered Widget inside Layout Context -->
        <div v-else-if="activeTab === 'widgets'" class="stage-view">
          <SandboxWidgetStage v-if="activeWidget" :active-widget="activeWidget">
            <component :is="activeWidget.component" v-bind="activeWidget.props || {}" />
          </SandboxWidgetStage>
          <div v-else class="empty-state">
            {{ i18n.t('sandbox.selectWidget') }}
          </div>
        </div>

        <!-- Render Inspector & Logs -->
        <SandboxInspectorLogs
          v-else-if="activeTab === 'logs'"
          :notifications="mock.notifications"
          :api-logs="mock.apiLogs"
          @clear-notifications="mock.clearNotifications"
          @clear-logs="mock.clearLogs"
        />
      </main>
    </div>
  </div>
</template>

<style>
@import '../../styles/theme-variables.css';

/* Global CSS variables & Reset */
html,
body,
#app {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
  width: 100%;
}
</style>

<style scoped>
.plugin-sandbox.dark {
  --bg-base: #090d16;
  --bg-surface: #0f172a;
  --bg-elevated: #1e293b;
  --bg-card: #263348;
  --border: #334155;
  --border-subtle: #1e293b;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent: #3b82f6;
  --accent-hover: #2563eb;
  --success-bg: #064e3b;
  --success-text: #34d399;
  --danger: #ef4444;
}

.plugin-sandbox.light {
  --bg-base: #f1f5f9;
  --bg-surface: #ffffff;
  --bg-elevated: #f8fafc;
  --bg-card: #e2e8f0;
  --border: #cbd5e1;
  --border-subtle: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --success-bg: #dcfce7;
  --success-text: #15803d;
  --danger: #dc2626;
}

.plugin-sandbox {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-base);
  color: var(--text-primary);
  overflow: hidden;
  position: relative;
}

.exit-fullscreen-fab {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 50px;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.exit-fullscreen-fab:hover {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.exit-fullscreen-fab svg {
  width: 16px;
  height: 16px;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.header-slide-enter-active,
.header-slide-leave-active {
  transition: all 0.2s ease;
}

.header-slide-enter-from,
.header-slide-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.sandbox-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.sandbox-body.no-header {
  height: 100vh;
}

.sandbox-stage {
  flex: 1;
  background: var(--bg-base);
  overflow-y: auto;
  position: relative;
  min-width: 0;
}

.stage-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.view-container {
  flex: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
