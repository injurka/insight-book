<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useScrollDrag } from '../lib/use-scroll-drag'
import { providePixiApp } from '../lib/use-shared-pixi'
import { useScrollStudyStore } from '../model/scroll-study.store'
import ResearchBoard from './partials/research-board.vue'
import ScrollBackground from './partials/scroll-background.vue'
import ScrollDragPreview from './partials/scroll-drag-preview.vue'
import ScrollHeader from './partials/scroll-header.vue'
import ScrollSidebar from './partials/scroll-sidebar.vue'

const scrollStore = useScrollStudyStore()
const pixiHostRef = ref<HTMLDivElement | null>(null)

// Initialize Single Shared PixiJS Application for the entire view
providePixiApp(pixiHostRef)

const {
  isPointerDragging,
  dragChar,
  dragPos,
  dragRotation,
  dragTiltX,
  dragTiltY,
  dragScale,
  burstEvent,
  onPointerDown,
} = useScrollDrag()

const isPanelOpen = ref(true)
const activeTab = ref<'symbols' | 'scrolls'>('symbols')

onMounted(() => {
  if (!scrollStore.activeWord) {
    scrollStore.initGrid()
  }
})
</script>

<template>
  <div class="scroll-desktop-view" :class="{ 'panel-open': isPanelOpen }">
    <!-- Single Shared PixiJS Canvas Layer across the entire view -->
    <div ref="pixiHostRef" class="global-pixi-host" />

    <!-- Particle Background -->
    <div class="background-wrapper">
      <ScrollBackground />
    </div>

    <!-- Sidebar Panel (Symbols & Mystery Scrolls) -->
    <ScrollSidebar
      v-model:is-open="isPanelOpen"
      v-model:active-tab="activeTab"
      @pointerdown-symbol="onPointerDown"
    />

    <!-- Center Workspace -->
    <div class="center-workspace">
      <ScrollHeader
        @open-scrolls="isPanelOpen = true; activeTab = 'scrolls'"
      />
      <ResearchBoard />
    </div>

    <!-- Floating Dynamic Drag Card with Physics & Canvas Burst -->
    <ScrollDragPreview
      :is-dragging="isPointerDragging"
      :drag-char="dragChar"
      :drag-pos="dragPos"
      :drag-rotation="dragRotation"
      :drag-tilt-x="dragTiltX"
      :drag-tilt-y="dragTiltY"
      :drag-scale="dragScale"
      :burst-event="burstEvent"
    />
  </div>
</template>

<style lang="scss" scoped>
.scroll-desktop-view {
  --font-pixel: 'Maple Mono CN', monospace;
  container: scroll-study / size;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background-color: #020617;
  display: flex;
  position: relative;
  overflow: hidden;
  color: #e2e8f0;
  font-family: 'Maple Mono CN', monospace;
}

:deep(.font-pixel) {
  font-family: var(--font-pixel);
}

.scroll-desktop-view :deep(button),
.scroll-desktop-view :deep(input),
.scroll-desktop-view :deep(select),
.scroll-desktop-view :deep(textarea) {
  font-family: inherit;
}

.global-pixi-host {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;

  :deep(canvas) {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.background-wrapper {
  position: absolute;
  inset: 0;
  z-index: auto;
  pointer-events: none;
}

.center-workspace {
  flex: 1;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
  padding: 24px;
}

@container scroll-study (max-width: 1500px) {
  .center-workspace {
    padding: 12px;
  }

  .panel-open .center-workspace :deep(.board-viewport) {
    transform: translateX(calc(min(320px, calc(100cqw - 80px)) / 2 + 6px));
  }
}
</style>
