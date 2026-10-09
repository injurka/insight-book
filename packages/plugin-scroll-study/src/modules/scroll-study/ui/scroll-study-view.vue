<script setup lang="ts">
import type { CharacterData } from '../../../data'
import type { PuzzleNode } from '../model/types'
import { Icon } from '@iconify/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { preloadGameAssets, withTimeout } from '../lib/game-assets'
import { playUiSound } from '../lib/ui-sound'
import { useGameLayout } from '../lib/use-game-layout'
import { useScrollDrag } from '../lib/use-scroll-drag'
import { providePixiApp } from '../lib/use-shared-pixi'
import { useScrollStudyStore } from '../model/scroll-study.store'
import GameLoadingScreen from './partials/game-loading-screen.vue'
import ResearchBoard from './partials/research-board.vue'
import ScrollBackground from './partials/scroll-background.vue'
import ScrollDragPreview from './partials/scroll-drag-preview.vue'
import ScrollHeader from './partials/scroll-header.vue'
import ScrollSidebar from './partials/scroll-sidebar.vue'

const router = useRouter()
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
const {
  rootRef,
  viewport,
  isCompact,
  isPanelOpen,
  panelWidth,
  layoutStyle,
} = useGameLayout()

const pixiHostRef = ref<HTMLDivElement | null>(null)
// Initialize Single Shared PixiJS Application for the entire view
const { isReady: isPixiReady } = providePixiApp(pixiHostRef)
/**
 * Экран загрузки показываем только если подготовка реально затянулась:
 * мгновенный старт из кеша не мигает оверлеем.
 */
const LOADING_SCREEN_DELAY_MS = 180
/** Страховка: если WebGL не поднялся, игра обязана открыться всё равно. */
const PIXI_FALLBACK_MS = 4000
/** Первую раскладку доски ждём ограниченно, чтобы не залипнуть на экране загрузки из-за медленного API. */
const FIRST_BOARD_TIMEOUT_MS = 2000
const loadRatio = ref(0)
const isAssetsReady = ref(false)
const isBoardReady = ref(false)
const isPixiSettled = ref(false)
const isGateVisible = ref(false)
const isRevealed = ref(false)
let loadingScreenTimer: ReturnType<typeof setTimeout> | undefined
let pixiFallbackTimer: ReturnType<typeof setTimeout> | undefined
const isLayoutDebug = import.meta.env.DEV && new URLSearchParams(window.location.search).has('layoutDebug')
const activeTab = ref<'symbols' | 'scrolls'>('symbols')
const pendingNodeId = ref<string | null>(null)

/** Игра открывается только с готовыми текстурами, рендерером и первой раскладкой. */
const isSceneReady = computed(() => isAssetsReady.value && isBoardReady.value && isPixiSettled.value)

const stopPixiWatch = watch(isPixiReady, (ready) => {
  if (!ready)
    return

  isPixiSettled.value = true
  clearTimeout(pixiFallbackTimer)
})
const stopReadyWatch = watch(isSceneReady, async (ready) => {
  if (!ready || isRevealed.value)
    return

  await nextTick()
  // Два кадра: к началу растворения оверлея под ним уже нарисован готовый кадр.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    isRevealed.value = true
  }))
})
watch(isPointerDragging, (dragging) => {
  if (dragging && isCompact.value)
    isPanelOpen.value = false
})
watch(isPanelOpen, (open) => {
  if (!open)
    pendingNodeId.value = null
})
watch(() => scrollStore.activeGrid, () => pendingNodeId.value = null)

function closePlugin() {
  playUiSound('select')
  void router.push('/')
}
function requestSymbol(node: PuzzleNode) {
  pendingNodeId.value = node.id
  activeTab.value = 'symbols'
  isPanelOpen.value = true
}
function placeSelectedSymbol(item: CharacterData) {
  const node = scrollStore.activeGrid.find(node => node.id === pendingNodeId.value)

  if (isCompact.value && node && !node.character) {
    const action = scrollStore.handleNodeDrop(item.char, node)

    if (action)
      playUiSound(action)
  }

  pendingNodeId.value = null

  if (isCompact.value)
    isPanelOpen.value = false
}

onMounted(async () => {
  loadingScreenTimer = setTimeout(() => {
    isGateVisible.value = true
  }, LOADING_SCREEN_DELAY_MS)
  pixiFallbackTimer = setTimeout(() => {
    isPixiSettled.value = true
  }, PIXI_FALLBACK_MS)

  const firstBoard = scrollStore.activeWord ? Promise.resolve() : scrollStore.initGrid()

  await Promise.all([
    preloadGameAssets((progress) => {
      loadRatio.value = progress.ratio
    }),
    withTimeout(firstBoard, FIRST_BOARD_TIMEOUT_MS),
  ])

  isAssetsReady.value = true
  isBoardReady.value = true
})
onBeforeUnmount(() => {
  stopPixiWatch()
  stopReadyWatch()
  clearTimeout(loadingScreenTimer)
  clearTimeout(pixiFallbackTimer)
})
</script>

<template>
  <div
    ref="rootRef"
    class="scroll-desktop-view"
    :class="{ 'panel-open': isPanelOpen, 'is-compact': isCompact, 'is-gated': !isRevealed, 'is-layout-debug': isLayoutDebug }"
    :style="layoutStyle"
  >
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
      :compact="isCompact"
      @symbol-selected="placeSelectedSymbol"
      @pointerdown-symbol="onPointerDown"
    />

    <button
      class="close-btn"
      aria-label="Закрыть и выйти из игры"
      title="Закрыть и выйти из игры"
      @click="closePlugin"
    >
      <Icon icon="mdi:close" class="close-icon" />
    </button>

    <!-- Center Workspace -->
    <div class="center-workspace" :inert="isCompact && isPanelOpen">
      <ScrollHeader
        @open-scrolls="isPanelOpen = true; activeTab = 'scrolls'"
      />
      <ResearchBoard :select-on-click="isCompact" @request-symbol="requestSymbol" />
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

    <output v-if="isLayoutDebug" class="layout-debug">
      {{ viewport.width }} × {{ viewport.height }} CSS px · {{ isCompact ? 'compact' : 'wide' }}
      · panel {{ panelWidth }}px · {{ isPanelOpen ? 'open' : 'closed' }}
    </output>

    <!-- Loading Gate: сцена открывается уже целиком отрисованной -->
    <Transition name="gate-fade">
      <GameLoadingScreen v-if="isGateVisible && !isRevealed" :ratio="loadRatio" />
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.scroll-desktop-view {
  --game-top: max(var(--game-gap), env(safe-area-inset-top, 0px));
  --game-bottom: max(var(--game-gap), env(safe-area-inset-bottom, 0px));
  --game-left: max(var(--game-gap), env(safe-area-inset-left, 0px));
  --game-right: max(var(--game-gap), env(safe-area-inset-right, 0px));
  --game-toolbar: 44px;
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
  overflow: clip;
  color: #e2e8f0;
  font-family: 'Maple Mono CN', monospace;
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.scroll-desktop-view :deep(*) {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.scroll-desktop-view::selection,
.scroll-desktop-view :deep(*::selection) {
  background: transparent;
  color: inherit;
}

.scroll-desktop-view :deep(:focus:not(:focus-visible)) {
  outline: none;
}

.scroll-desktop-view :deep(:focus-visible) {
  outline-color: #8e5c32;
}

:deep(.font-pixel) {
  font-family: var(--font-pixel);
}

/*
 * До готовности сцены содержимое не рисуется: игрок не должен видеть, как
 * интерфейс «дособирается» из полутеней, пока грузятся текстуры. Тёмная
 * подложка макета при этом остаётся — на неё ложится экран загрузки.
 */
.scroll-desktop-view.is-gated > :not(.game-loading) {
  visibility: hidden;
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
    max-width: 100%;
    max-height: 100%;
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
  padding: 32px 0;
}

.close-btn {
  position: absolute;
  top: var(--game-top);
  right: var(--game-right);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: url('../../../assets/ui-kit/square-button/normal.png') center / 100% 100% no-repeat;
  box-shadow: 0 4px 12px #160a0599;
  border: 0;
  color: #c4a16c;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    color: #f87171;
    background-image: url('../../../assets/ui-kit/square-button/hover.png');
  }

  &:active {
    background-image: url('../../../assets/ui-kit/square-button/pressed.png');
  }

  .close-icon {
    font-size: 1.35rem;
  }
}

.close-btn:focus-visible {
  outline: 2px solid #ffe19a;
  outline-offset: 2px;
}

.close-btn:focus-visible {
  outline: 2px solid #ffe19a;
  outline-offset: 2px;
}

.is-layout-debug :deep(.board-stage) {
  outline: 1px dashed #38bdf8;
}

.is-layout-debug :deep(.sidebar-panel) {
  outline: 1px dashed #fbbf24;
}

.layout-debug {
  position: absolute;
  bottom: var(--game-bottom);
  right: var(--game-right);
  z-index: 60;
  max-width: calc(100% - var(--game-left) - var(--game-right));
  padding: 6px 10px;
  background: #020617e6;
  font: 12px/1.5 monospace;
  pointer-events: none;
}

.gate-fade-enter-active,
.gate-fade-leave-active {
  transition: opacity 0.34s ease;
}

/* Пока оверлей растворяется, он уже не перехватывает клики. */
.gate-fade-leave-active {
  pointer-events: none;
}

.gate-fade-enter-from,
.gate-fade-leave-to {
  opacity: 0;
}
</style>
