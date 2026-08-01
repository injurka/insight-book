<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useScrollDrag } from '../lib/use-scroll-drag'
import { useScrollStudyStore } from '../model/scroll-study.store'
import ResearchBoard from './partials/research-board.vue'
import ScrollBackground from './partials/scroll-background.vue'
import ScrollDragPreview from './partials/scroll-drag-preview.vue'
import ScrollHeader from './partials/scroll-header.vue'
import ScrollSidebar from './partials/scroll-sidebar.vue'

const scrollStore = useScrollStudyStore()
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
  <div class="scroll-desktop-view">
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
  width: 100%;
  height: 100%;
  background-color: #020617;
  display: flex;
  position: relative;
  overflow: hidden;
  color: #e2e8f0;
  font-family: inherit;
}

.background-wrapper {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.center-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 10;
  padding: 24px;
}
</style>
