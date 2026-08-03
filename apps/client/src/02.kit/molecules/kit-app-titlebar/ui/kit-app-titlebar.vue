<script setup lang="ts">
import type { Window as TauriWindow } from '@tauri-apps/api/window'
import { Icon } from '@iconify/vue'
import { invoke } from '@tauri-apps/api/core'
import { onMounted, onUnmounted, ref } from 'vue'

import { isMobile, isTauri } from '~/01.shared/lib/env'

const showTitlebar = ref(isTauri && !isMobile)
const isMaximized = ref(false)

let appWindow: TauriWindow | null = null
let unlistenResize: (() => void) | null = null

function minimize() {
  appWindow?.minimize()
}

function toggleMaximize() {
  appWindow?.toggleMaximize()
}

function close() {
  appWindow?.close()
}

onMounted(async () => {
  if (isTauri) {
    try {
      const isHypr = await invoke<boolean>('is_hyprland').catch(() => false)
      if (isHypr) {
        showTitlebar.value = false

        return
      }

      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      appWindow = win
      isMaximized.value = await win.isMaximized()

      unlistenResize = await win.onResized(async () => {
        isMaximized.value = await win.isMaximized()
      })
    }
    catch (e) {
      console.error('Failed to init Tauri window API', e)
    }
  }
})

onUnmounted(() => {
  if (unlistenResize)
    unlistenResize()
})
</script>

<template>
  <div v-if="showTitlebar" data-tauri-drag-region class="app-titlebar">
    <div class="titlebar-title" data-tauri-drag-region>
      InsightBook
    </div>
    <div class="titlebar-actions">
      <button class="titlebar-btn" title="Свернуть" @click="minimize">
        <Icon icon="mdi:window-minimize" />
      </button>
      <button class="titlebar-btn" :title="isMaximized ? 'Восстановить' : 'Развернуть'" @click="toggleMaximize">
        <Icon :icon="isMaximized ? 'mdi:window-restore' : 'mdi:window-maximize'" />
      </button>
      <button class="titlebar-btn close-btn" title="Закрыть" @click="close">
        <Icon icon="mdi:window-close" />
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-titlebar {
  height: 32px;
  background: var(--bg-primary-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-secondary-color);
  z-index: 9999;
}

.titlebar-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  padding-left: 12px;
  flex-grow: 1;
  height: 100%;
  display: flex;
  align-items: center;
  cursor: default;
}

.titlebar-actions {
  display: flex;
  height: 100%;
}

.titlebar-btn {
  width: 46px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--fg-secondary-color);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition:
    background-color 0.2s,
    color 0.2s;
  font-size: 1.1rem;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
  }

  &.close-btn:hover {
    background-color: #e81123;
    color: #ffffff;
  }
}
</style>
