<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { preloadGameAssets, withTimeout } from '../lib/game-assets'
import { useScrollDrag } from '../lib/use-scroll-drag'
import { providePixiApp } from '../lib/use-shared-pixi'
import { useScrollStudyStore } from '../model/scroll-study.store'
import GameLoadingScreen from './partials/game-loading-screen.vue'
import ResearchBoard from './partials/research-board.vue'
import ScrollBackground from './partials/scroll-background.vue'
import ScrollDragPreview from './partials/scroll-drag-preview.vue'
import ScrollHeader from './partials/scroll-header.vue'
import ScrollSidebar from './partials/scroll-sidebar.vue'

const scrollStore = useScrollStudyStore()
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
</script>

<template>
  <div class="scroll-desktop-view" :class="{ 'panel-open': isPanelOpen, 'is-gated': !isRevealed }">
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

    <!-- Loading Gate: сцена открывается уже целиком отрисованной -->
    <Transition name="gate-fade">
      <GameLoadingScreen v-if="isGateVisible && !isRevealed" :ratio="loadRatio" />
    </Transition>
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

@media (prefers-reduced-motion: reduce) {
  .gate-fade-enter-active,
  .gate-fade-leave-active {
    transition: none;
  }
}
</style>
